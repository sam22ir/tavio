import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { fileUrl, uploadFile } from '@/core/files/service';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { nextNumber } from '@/core/sequences';
import { getPartner } from '@/modules/contacts/service/partners';
import { products } from '@/modules/products/schema';
import { deliveries, deliveryLines, type Delivery } from '../schema';
import { closeReservations, aggregateLines, type ReservableLine } from './reservations';
import { fromMilli } from './quantity';
import { moveLines } from './moves';
import { ensureDefaultWarehouse } from './warehouses';

export const DELIVERY_SOURCE_ENTITY = 'inventory.delivery';
export const CONTRACT_SOURCE_ENTITY = 'credit_sales.contract';
export const SIGNED_BY_NAME_MAX = 200;

/** Reason codes carried in `error.details.reason`. The UI maps them to `inventory.errors.<reason>`. */
export const SIGNED_BY_REQUIRED = 'signed_by_required';
export const SIGNED_BY_TOO_LONG = 'signed_by_too_long';

/**
 * Pure rule: a delivery can only be validated once the person who received it is named.
 * Returns the trimmed name, or a VALIDATION error whose `details.reason` names the cause.
 */
export function requireSignedByName(name: string | null | undefined): Result<string> {
  const trimmed = (name ?? '').trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION',
        message: 'signed_by_name is required to validate a delivery',
        details: { reason: SIGNED_BY_REQUIRED },
      },
    };
  }
  if (trimmed.length > SIGNED_BY_NAME_MAX) {
    return {
      ok: false,
      error: { code: 'VALIDATION', message: 'signed_by_name is too long', details: { reason: SIGNED_BY_TOO_LONG } },
    };
  }
  return ok(trimmed);
}

/**
 * Display names of the partners behind the given ids, read through the contacts service.
 * Unknown ids are left out. Returns the first failure (e.g. missing contacts permission).
 */
export async function partnerDisplayNames(ctx: Ctx, partnerIds: readonly string[]): Promise<Result<Map<string, string>>> {
  const names = new Map<string, string>();
  for (const id of new Set(partnerIds)) {
    const r = await getPartner(ctx, id);
    if (!r.ok) {
      if (r.error.code === 'NOT_FOUND') continue;
      return r;
    }
    names.set(id, r.value.displayName);
  }
  return ok(names);
}

export interface DeliveryRow {
  id: string;
  number: string;
  partnerId: string;
  sourceEntity: string | null;
  sourceId: string | null;
  state: Delivery['state'];
  scheduledDate: string | null;
  deliveredAt: string | null;
  lineCount: number;
}

/**
 * Creates a draft delivery for a source document (e.g. a credit contract that became active).
 * Idempotent: when a live delivery already exists for the source, nothing is created.
 * No permission check: called from event handlers.
 */
export async function createDraftDelivery(
  ctx: Ctx,
  input: {
    partnerId: string;
    sourceEntity: string;
    sourceId: string;
    lines: readonly ReservableLine[];
    note?: string;
  },
): Promise<Result<{ deliveryId: string | null; created: boolean }>> {
  const [live] = await ctx.tx
    .select({ id: deliveries.id })
    .from(deliveries)
    .where(
      and(
        eq(deliveries.companyId, ctx.companyId),
        eq(deliveries.sourceEntity, input.sourceEntity),
        eq(deliveries.sourceId, input.sourceId),
        ne(deliveries.state, 'cancelled'),
      ),
    );
  if (live) return ok({ deliveryId: live.id, created: false });

  const totals = aggregateLines(input.lines);
  if (totals.size === 0) return ok({ deliveryId: null, created: false });

  const number = await nextNumber(ctx, 'inventory.delivery', { prefix: 'LIV-' });
  const [row] = await ctx.tx
    .insert(deliveries)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      number,
      partnerId: input.partnerId,
      sourceEntity: input.sourceEntity,
      sourceId: input.sourceId,
      state: 'draft',
      note: input.note ?? null,
    })
    .returning({ id: deliveries.id });
  if (!row) throw new Error('delivery insert returned no row');

  for (const [productId, milli] of totals) {
    await ctx.tx.insert(deliveryLines).values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      deliveryId: row.id,
      productId,
      quantity: fromMilli(milli),
    });
  }
  await audit(ctx, { entity: 'inventory.delivery', recordId: row.id, action: 'create', after: { number, sourceEntity: input.sourceEntity, sourceId: input.sourceId } });
  return ok({ deliveryId: row.id, created: true });
}

/**
 * Validates a delivery: creates done stock moves from the internal location to the customer
 * location for each line, consumes the reservations of the source document and marks the delivery done.
 */
export async function validateDelivery(ctx: Ctx, deliveryId: string): Promise<Result<{ moves: number }>> {
  const perm = requirePerm(ctx, 'inventory.delivery.post');
  if (!perm.ok) return perm;

  const [delivery] = await ctx.tx
    .select()
    .from(deliveries)
    .where(and(eq(deliveries.id, deliveryId), eq(deliveries.companyId, ctx.companyId)))
    .for('update');
  if (!delivery) return err('NOT_FOUND', 'Delivery not found');
  if (delivery.state !== 'draft' && delivery.state !== 'ready') return err('CONFLICT', 'Delivery cannot be validated in this state');
  const signer = requireSignedByName(delivery.signedByName);
  if (!signer.ok) return signer;

  const lines = await ctx.tx
    .select({ productId: deliveryLines.productId, quantity: deliveryLines.quantity })
    .from(deliveryLines)
    .where(and(eq(deliveryLines.deliveryId, delivery.id), eq(deliveryLines.companyId, ctx.companyId)));

  const wh = await ensureDefaultWarehouse(ctx);
  const posted = await moveLines(ctx, {
    lines,
    sourceEntity: DELIVERY_SOURCE_ENTITY,
    sourceId: delivery.id,
    reference: delivery.number,
    fromLocationId: wh.internalLocationId,
    toLocationId: wh.customerLocationId,
    post: true,
  });
  if (!posted.ok) return posted;

  if (delivery.sourceEntity && delivery.sourceId) {
    const consumed = await closeReservations(ctx, {
      sourceEntity: delivery.sourceEntity,
      sourceId: delivery.sourceId,
      state: 'consumed',
    });
    if (!consumed.ok) return consumed;
  }

  await ctx.tx
    .update(deliveries)
    .set({ state: 'done', deliveredAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(deliveries.id, delivery.id));
  await audit(ctx, {
    entity: 'inventory.delivery',
    recordId: delivery.id,
    action: 'validate',
    before: { state: delivery.state },
    after: { state: 'done' },
  });
  return ok({ moves: posted.value.created });
}

/** Cancels a delivery that has not been validated yet. */
export async function cancelDelivery(ctx: Ctx, deliveryId: string): Promise<Result<void>> {
  const perm = requirePerm(ctx, 'inventory.delivery.cancel');
  if (!perm.ok) return perm;

  const [delivery] = await ctx.tx
    .select({ id: deliveries.id, state: deliveries.state })
    .from(deliveries)
    .where(and(eq(deliveries.id, deliveryId), eq(deliveries.companyId, ctx.companyId)))
    .for('update');
  if (!delivery) return err('NOT_FOUND', 'Delivery not found');
  if (delivery.state !== 'draft' && delivery.state !== 'ready') return err('CONFLICT', 'Only open deliveries can be cancelled');

  await ctx.tx
    .update(deliveries)
    .set({ state: 'cancelled', updatedAt: sql`now()` })
    .where(eq(deliveries.id, delivery.id));
  await audit(ctx, {
    entity: 'inventory.delivery',
    recordId: delivery.id,
    action: 'cancel',
    before: { state: delivery.state },
    after: { state: 'cancelled' },
  });
  return ok(undefined);
}

/** Deliveries of the company, newest first, with their line count. */
export async function listDeliveries(ctx: Ctx, opts: { limit?: number } = {}): Promise<Result<DeliveryRow[]>> {
  const perm = requirePerm(ctx, 'inventory.delivery.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select({
      id: deliveries.id,
      number: deliveries.number,
      partnerId: deliveries.partnerId,
      sourceEntity: deliveries.sourceEntity,
      sourceId: deliveries.sourceId,
      state: deliveries.state,
      scheduledDate: deliveries.scheduledDate,
      deliveredAt: deliveries.deliveredAt,
      lineCount: sql<number>`(select count(*)::int from ${deliveryLines} where ${deliveryLines.deliveryId} = ${deliveries.id})`,
    })
    .from(deliveries)
    .where(eq(deliveries.companyId, ctx.companyId))
    .orderBy(desc(deliveries.createdAt))
    .limit(opts.limit ?? 100);
  return ok(
    rows.map((r) => ({
      ...r,
      state: r.state as Delivery['state'],
      deliveredAt: r.deliveredAt ? r.deliveredAt.toISOString() : null,
    })),
  );
}

export type DeliveryFileKind = 'signature' | 'proof';

export interface DeliveryDetail {
  id: string;
  number: string;
  partnerId: string;
  sourceEntity: string | null;
  sourceId: string | null;
  state: Delivery['state'];
  scheduledDate: string | null;
  deliveredAt: string | null;
  signedByName: string | null;
  signatureFileId: string | null;
  proofFileId: string | null;
  note: string | null;
  lines: { productId: string; productName: string; quantity: string }[];
}

/** One delivery with its lines, for the detail page. */
export async function getDelivery(ctx: Ctx, deliveryId: string): Promise<Result<DeliveryDetail>> {
  const perm = requirePerm(ctx, 'inventory.delivery.read');
  if (!perm.ok) return perm;
  const [row] = await ctx.tx
    .select()
    .from(deliveries)
    .where(and(eq(deliveries.id, deliveryId), eq(deliveries.companyId, ctx.companyId)));
  if (!row) return err('NOT_FOUND', 'Delivery not found');
  const lines = await ctx.tx
    .select({
      productId: deliveryLines.productId,
      productName: products.name,
      quantity: deliveryLines.quantity,
    })
    .from(deliveryLines)
    .innerJoin(products, eq(products.id, deliveryLines.productId))
    .where(and(eq(deliveryLines.deliveryId, row.id), eq(deliveryLines.companyId, ctx.companyId)));
  return ok({
    id: row.id,
    number: row.number,
    partnerId: row.partnerId,
    sourceEntity: row.sourceEntity,
    sourceId: row.sourceId,
    state: row.state as Delivery['state'],
    scheduledDate: row.scheduledDate,
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
    signedByName: row.signedByName,
    signatureFileId: row.signatureFileId,
    proofFileId: row.proofFileId,
    note: row.note,
    lines,
  });
}

/** Sets the name of the person who signed for the delivery. An empty name clears it. Open deliveries only. */
export async function setDeliverySignedBy(
  ctx: Ctx,
  input: { deliveryId: string; signedByName: string },
): Promise<Result<void>> {
  const perm = requirePerm(ctx, 'inventory.delivery.post');
  if (!perm.ok) return perm;
  const name = input.signedByName.trim();
  if (name.length > SIGNED_BY_NAME_MAX) return err('VALIDATION', 'signed_by_name is too long');

  const [delivery] = await ctx.tx
    .select({ id: deliveries.id, state: deliveries.state })
    .from(deliveries)
    .where(and(eq(deliveries.id, input.deliveryId), eq(deliveries.companyId, ctx.companyId)))
    .for('update');
  if (!delivery) return err('NOT_FOUND', 'Delivery not found');
  if (delivery.state !== 'draft' && delivery.state !== 'ready') return err('CONFLICT', 'Delivery is already closed');

  await ctx.tx
    .update(deliveries)
    .set({ signedByName: name.length > 0 ? name : null, updatedAt: sql`now()` })
    .where(eq(deliveries.id, delivery.id));
  await audit(ctx, { entity: 'inventory.delivery', recordId: delivery.id, action: 'update', after: { signedByName: name.length > 0 } });
  return ok(undefined);
}

/**
 * Stores a signature or proof file through the shared file service and points the delivery at it.
 * Open deliveries only.
 */
export async function attachDeliveryFile(
  ctx: Ctx,
  input: { deliveryId: string; kind: DeliveryFileKind; fileName: string; contentType: string; bytes: Uint8Array },
): Promise<Result<{ fileId: string }>> {
  const perm = requirePerm(ctx, 'inventory.delivery.post');
  if (!perm.ok) return perm;

  const [delivery] = await ctx.tx
    .select({ id: deliveries.id, state: deliveries.state })
    .from(deliveries)
    .where(and(eq(deliveries.id, input.deliveryId), eq(deliveries.companyId, ctx.companyId)))
    .for('update');
  if (!delivery) return err('NOT_FOUND', 'Delivery not found');
  if (delivery.state !== 'draft' && delivery.state !== 'ready') return err('CONFLICT', 'Delivery is already closed');

  const up = await uploadFile(ctx, {
    entity: DELIVERY_SOURCE_ENTITY,
    recordId: delivery.id,
    fileName: input.fileName,
    contentType: input.contentType,
    bytes: input.bytes,
    kind: `delivery_${input.kind}`,
  });
  if (!up.ok) return up;

  await ctx.tx
    .update(deliveries)
    .set(input.kind === 'signature' ? { signatureFileId: up.value.id, updatedAt: sql`now()` } : { proofFileId: up.value.id, updatedAt: sql`now()` })
    .where(eq(deliveries.id, delivery.id));
  await audit(ctx, { entity: 'inventory.delivery', recordId: delivery.id, action: 'update', after: { [input.kind]: up.value.id } });
  return ok({ fileId: up.value.id });
}

/** Signed GET URL for a delivery's signature or proof file. */
export async function deliveryFileUrl(ctx: Ctx, fileId: string): Promise<Result<string>> {
  const perm = requirePerm(ctx, 'inventory.delivery.read');
  if (!perm.ok) return perm;
  return fileUrl(ctx, fileId);
}
