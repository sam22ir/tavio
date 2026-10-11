import { isUuid } from '@/core/relations/uuid';
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { fileUrl, uploadFile } from '@/core/files/service';
import { emit } from '@/core/events';
import type { InventoryDeliveryValidated } from '@/core/events/catalog';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { nextNumber } from '@/core/sequences';
import { getPartner } from '@/modules/contacts/service/partners';
import { products } from '@/modules/products/schema';
import { deliveries, deliveryLines, type Delivery } from '../schema';
import { closeReservations, aggregateLines, reserveLines, type ReservableLine } from './reservations';
import { fromMilli } from './quantity';
import { moveLines, stockTrackedLines } from './moves';
import { ensureDefaultWarehouse } from './warehouses';
import { planDeliveryValidation } from './delivery-plan';

export const DELIVERY_SOURCE_ENTITY = 'inventory.delivery';
export const CONTRACT_SOURCE_ENTITY = 'credit_sales.contract';
export const SALE_ORDER_SOURCE_ENTITY = 'sales.order';
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

export interface DeliveryLineRef {
  productId: string;
  quantity: string;
  saleOrderLineId?: string | null;
}

/**
 * Creates a draft delivery for a sale order, one line per stock-tracked goods line of the order, each
 * pointing back at its sale order line. Idempotent: a live delivery for the order is left alone.
 * No permission check: called from event handlers.
 */
export async function createOrderDelivery(
  ctx: Ctx,
  input: { partnerId: string; sourceEntity: string; sourceId: string; lines: readonly DeliveryLineRef[]; note?: string },
): Promise<Result<{ deliveryId: string | null; created: boolean }>> {
  if (input.lines.length === 0) return ok({ deliveryId: null, created: false });
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
  const id = await insertDeliveryWithLines(ctx, { ...input, originDeliveryId: null }, input.lines);
  return ok({ deliveryId: id, created: true });
}

/** Inserts a draft delivery and its lines. Returns the delivery id. Caller checks idempotency and permissions. */
async function insertDeliveryWithLines(
  ctx: Ctx,
  head: { partnerId: string; sourceEntity: string; sourceId: string; note?: string; originDeliveryId: string | null },
  lines: readonly DeliveryLineRef[],
): Promise<string> {
  const number = await nextNumber(ctx, 'inventory.delivery', { prefix: 'LIV-' });
  const [row] = await ctx.tx
    .insert(deliveries)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      number,
      partnerId: head.partnerId,
      sourceEntity: head.sourceEntity,
      sourceId: head.sourceId,
      state: 'draft',
      note: head.note ?? null,
      originDeliveryId: head.originDeliveryId,
    })
    .returning({ id: deliveries.id });
  if (!row) throw new Error('delivery insert returned no row');
  for (const line of lines) {
    await ctx.tx.insert(deliveryLines).values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      deliveryId: row.id,
      productId: line.productId,
      quantity: line.quantity,
      saleOrderLineId: line.saleOrderLineId ?? null,
    });
  }
  await audit(ctx, {
    entity: 'inventory.delivery',
    recordId: row.id,
    action: 'create',
    after: { number, sourceEntity: head.sourceEntity, sourceId: head.sourceId, originDeliveryId: head.originDeliveryId },
  });
  return row.id;
}

export interface ValidateDeliveryOptions {
  /** Quantity handed over per delivery line id. A missing line is delivered in full. */
  deliveredQty?: Readonly<Record<string, string>>;
  /** Drop the remainder instead of creating a backorder. */
  noBackorder?: boolean;
}

/**
 * Validates a delivery. Posts one stock move per line for the quantity delivered (not the demanded one),
 * records the delivered quantities, and marks the delivery done. Whatever is left over becomes a backorder
 * (a new draft delivery linked to this one), unless `noBackorder` drops it. Contract reservations are
 * consumed, and re-reserved for the backorder. Sale order deliveries emit inventory.delivery.validated so
 * the order's progress follows.
 */
export async function validateDelivery(
  ctx: Ctx,
  deliveryId: string,
  opts: ValidateDeliveryOptions = {},
): Promise<Result<{ moves: number; backorderId: string | null }>> {
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
    .select({
      id: deliveryLines.id,
      productId: deliveryLines.productId,
      quantity: deliveryLines.quantity,
      saleOrderLineId: deliveryLines.saleOrderLineId,
    })
    .from(deliveryLines)
    .where(and(eq(deliveryLines.deliveryId, delivery.id), eq(deliveryLines.companyId, ctx.companyId)));

  const planned = planDeliveryValidation({
    lines: lines.map((l) => ({ id: l.id, quantity: l.quantity })),
    delivered: opts.deliveredQty ?? {},
    noBackorder: opts.noBackorder ?? false,
  });
  if (!planned.ok) return planned;
  const plan = planned.value;
  const byId = new Map(lines.map((l) => [l.id, l]));

  const wh = await ensureDefaultWarehouse(ctx);
  // Only stock-tracked goods move; a service line on the delivery is documentary.
  const movable = plan.lines
    .filter((p) => p.deliveredQty !== '0.000')
    .map((p) => ({ productId: byId.get(p.id)?.productId ?? '', quantity: p.deliveredQty }));
  const posted = await moveLines(ctx, {
    lines: await stockTrackedLines(ctx, movable),
    sourceEntity: DELIVERY_SOURCE_ENTITY,
    sourceId: delivery.id,
    reference: delivery.number,
    fromLocationId: wh.internalLocationId,
    toLocationId: wh.customerLocationId,
    post: true,
  });
  if (!posted.ok) return posted;

  for (const p of plan.lines) {
    await ctx.tx
      .update(deliveryLines)
      .set({ deliveredQty: p.deliveredQty, updatedAt: sql`now()` })
      .where(eq(deliveryLines.id, p.id));
  }

  // Mark the delivery done before any backorder is inserted: the open-delivery unique index on
  // (company, source) would otherwise reject the remainder, which shares this delivery's source.
  await ctx.tx
    .update(deliveries)
    .set({ state: 'done', deliveredAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(deliveries.id, delivery.id));

  let backorderId: string | null = null;
  if (plan.backorder) {
    const remainder = plan.backorderLines.map((b) => {
      const src = byId.get(b.id);
      return { productId: src?.productId ?? '', quantity: b.quantity, saleOrderLineId: src?.saleOrderLineId ?? null };
    });
    backorderId = await insertDeliveryWithLines(
      ctx,
      {
        partnerId: delivery.partnerId,
        sourceEntity: delivery.sourceEntity ?? '',
        sourceId: delivery.sourceId ?? '',
        note: delivery.note ?? undefined,
        originDeliveryId: delivery.id,
      },
      remainder,
    );
  }

  if (delivery.sourceEntity && delivery.sourceId) {
    // Reservations of a contract are used up by what left. A backorder re-reserves its remainder.
    const consumed = await closeReservations(ctx, {
      sourceEntity: delivery.sourceEntity,
      sourceId: delivery.sourceId,
      state: 'consumed',
    });
    if (!consumed.ok) return consumed;
    if (plan.backorder && delivery.sourceEntity === CONTRACT_SOURCE_ENTITY) {
      const reserved = await reserveLines(ctx, {
        lines: plan.backorderLines.map((b) => ({ productId: byId.get(b.id)?.productId ?? '', quantity: b.quantity })),
        locationId: wh.internalLocationId,
        sourceEntity: delivery.sourceEntity,
        sourceId: delivery.sourceId,
      });
      if (!reserved.ok) return reserved;
    }
  }

  await audit(ctx, {
    entity: 'inventory.delivery',
    recordId: delivery.id,
    action: 'validate',
    before: { state: delivery.state },
    after: { state: 'done', backorderId, cancelledQty: plan.cancelledQty },
  });

  if (delivery.sourceEntity === SALE_ORDER_SOURCE_ENTITY && delivery.sourceId) {
    const payload: InventoryDeliveryValidated = {
      deliveryId: delivery.id,
      sourceEntity: delivery.sourceEntity,
      sourceId: delivery.sourceId,
      lines: plan.lines
        .filter((p) => byId.get(p.id)?.saleOrderLineId)
        .map((p) => ({
          saleOrderLineId: byId.get(p.id)?.saleOrderLineId ?? '',
          deliveredQty: p.deliveredQty,
          cancelledQty: opts.noBackorder ? p.remainder : '0.000',
        })),
    };
    await emit(ctx, { name: 'inventory.delivery.validated', payload });
  }
  return ok({ moves: posted.value.created, backorderId });
}

/** Open deliveries can still be cancelled, signed for or validated. */
export function isOpenDeliveryState(state: string): boolean {
  return state === 'draft' || state === 'ready';
}

/**
 * Sets one open delivery to cancelled and, when it comes from a source document (e.g. a credit
 * contract), releases that source's active reservations. Caller checks state and permissions.
 */
async function cancelDeliveryRow(
  ctx: Ctx,
  delivery: { id: string; state: Delivery['state']; sourceEntity: string | null; sourceId: string | null },
): Promise<Result<void>> {
  await ctx.tx
    .update(deliveries)
    .set({ state: 'cancelled', updatedAt: sql`now()` })
    .where(eq(deliveries.id, delivery.id));
  if (delivery.sourceEntity && delivery.sourceId) {
    const released = await closeReservations(ctx, {
      sourceEntity: delivery.sourceEntity,
      sourceId: delivery.sourceId,
      state: 'released',
    });
    if (!released.ok) return released;
  }
  await audit(ctx, {
    entity: 'inventory.delivery',
    recordId: delivery.id,
    action: 'cancel',
    before: { state: delivery.state },
    after: { state: 'cancelled' },
  });
  return ok(undefined);
}

/** Cancels a delivery that has not been validated yet. Releases its reservations when contract-sourced. */
export async function cancelDelivery(ctx: Ctx, deliveryId: string): Promise<Result<void>> {
  const perm = requirePerm(ctx, 'inventory.delivery.cancel');
  if (!perm.ok) return perm;

  const [delivery] = await ctx.tx
    .select({
      id: deliveries.id,
      state: deliveries.state,
      sourceEntity: deliveries.sourceEntity,
      sourceId: deliveries.sourceId,
    })
    .from(deliveries)
    .where(and(eq(deliveries.id, deliveryId), eq(deliveries.companyId, ctx.companyId)))
    .for('update');
  if (!delivery) return err('NOT_FOUND', 'Delivery not found');
  if (!isOpenDeliveryState(delivery.state)) return err('CONFLICT', 'Only open deliveries can be cancelled');

  return cancelDeliveryRow(ctx, { ...delivery, state: delivery.state as Delivery['state'] });
}

/**
 * Cancels every open delivery (draft or ready) sourced from a document, e.g. a credit contract
 * that was cancelled. Releases each cancelled delivery's reservations.
 * No permission check: called from event handlers.
 */
export async function cancelOpenDeliveriesForSource(
  ctx: Ctx,
  input: { sourceEntity: string; sourceId: string },
): Promise<Result<{ cancelled: number }>> {
  const rows = await ctx.tx
    .select({
      id: deliveries.id,
      state: deliveries.state,
      sourceEntity: deliveries.sourceEntity,
      sourceId: deliveries.sourceId,
    })
    .from(deliveries)
    .where(
      and(
        eq(deliveries.companyId, ctx.companyId),
        eq(deliveries.sourceEntity, input.sourceEntity),
        eq(deliveries.sourceId, input.sourceId),
        inArray(deliveries.state, ['draft', 'ready']),
      ),
    )
    .for('update');
  for (const row of rows) {
    const done = await cancelDeliveryRow(ctx, { ...row, state: row.state as Delivery['state'] });
    if (!done.ok) return done;
  }
  return ok({ cancelled: rows.length });
}

export const DELIVERY_RETURN_SOURCE_ENTITY = 'inventory.delivery.return';

/**
 * Takes back the goods of every validated (done) delivery sourced from a document, e.g. a credit
 * contract cancelled after delivery: one posted move per product from the customer location to the
 * internal location, per delivery. Idempotent (moveLines skips products already moved back).
 * No permission check: called from event handlers.
 */
export async function returnDoneDeliveriesForSource(
  ctx: Ctx,
  input: { sourceEntity: string; sourceId: string },
): Promise<Result<{ returned: number }>> {
  const rows = await ctx.tx
    .select({ id: deliveries.id, number: deliveries.number })
    .from(deliveries)
    .where(
      and(
        eq(deliveries.companyId, ctx.companyId),
        eq(deliveries.sourceEntity, input.sourceEntity),
        eq(deliveries.sourceId, input.sourceId),
        eq(deliveries.state, 'done'),
      ),
    )
    .for('update');
  if (rows.length === 0) return ok({ returned: 0 });

  const wh = await ensureDefaultWarehouse(ctx);
  for (const row of rows) {
    const lines = await ctx.tx
      .select({ productId: deliveryLines.productId, quantity: deliveryLines.quantity })
      .from(deliveryLines)
      .where(and(eq(deliveryLines.deliveryId, row.id), eq(deliveryLines.companyId, ctx.companyId)));
    const posted = await moveLines(ctx, {
      lines,
      sourceEntity: DELIVERY_RETURN_SOURCE_ENTITY,
      sourceId: row.id,
      reference: `${row.number}-RET`,
      fromLocationId: wh.customerLocationId,
      toLocationId: wh.internalLocationId,
      post: true,
    });
    if (!posted.ok) return posted;
  }
  return ok({ returned: rows.length });
}

export type SourceDeliveryStatus = 'to_deliver' | 'partial' | 'delivered';

export interface SourceDeliveryRow {
  id: string;
  number: string;
  state: Delivery['state'];
  deliveredAt: string | null;
}

/**
 * Delivery status of a source document (e.g. a credit contract) and its live deliveries, newest first.
 * 'delivered' when every live delivery is validated, 'partial' when some are validated and some still open,
 * otherwise 'to_deliver'. Cancelled deliveries are left out.
 */
export async function sourceDeliveryStatus(
  ctx: Ctx,
  input: { sourceEntity: string; sourceId: string },
): Promise<Result<{ status: SourceDeliveryStatus; deliveries: SourceDeliveryRow[] }>> {
  const perm = requirePerm(ctx, 'inventory.delivery.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select({ id: deliveries.id, number: deliveries.number, state: deliveries.state, deliveredAt: deliveries.deliveredAt })
    .from(deliveries)
    .where(
      and(
        eq(deliveries.companyId, ctx.companyId),
        eq(deliveries.sourceEntity, input.sourceEntity),
        eq(deliveries.sourceId, input.sourceId),
        ne(deliveries.state, 'cancelled'),
      ),
    )
    .orderBy(desc(deliveries.createdAt));
  const done = rows.filter((r) => r.state === 'done').length;
  const open = rows.length - done;
  const status: SourceDeliveryStatus = done > 0 && open > 0 ? 'partial' : done > 0 ? 'delivered' : 'to_deliver';
  return ok({
    status,
    deliveries: rows.map((r) => ({
      id: r.id,
      number: r.number,
      state: r.state as Delivery['state'],
      deliveredAt: r.deliveredAt ? r.deliveredAt.toISOString() : null,
    })),
  });
}

/** Deliveries of the company, newest first, with their line count. */
export async function listDeliveries(
  ctx: Ctx,
  opts: { limit?: number; sourceId?: string; partnerId?: string } = {},
): Promise<Result<DeliveryRow[]>> {
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
    .where(and(
      eq(deliveries.companyId, ctx.companyId),
      isUuid(opts.sourceId) ? eq(deliveries.sourceId, opts.sourceId) : undefined,
      isUuid(opts.partnerId) ? eq(deliveries.partnerId, opts.partnerId) : undefined,
    ))
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
  /** Delivery this one is the backorder of, when set. */
  originDeliveryId: string | null;
  originNumber: string | null;
  lines: { id: string; productId: string; productName: string; quantity: string; deliveredQty: string }[];
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
      id: deliveryLines.id,
      productId: deliveryLines.productId,
      productName: products.name,
      quantity: deliveryLines.quantity,
      deliveredQty: deliveryLines.deliveredQty,
    })
    .from(deliveryLines)
    .innerJoin(products, eq(products.id, deliveryLines.productId))
    .where(and(eq(deliveryLines.deliveryId, row.id), eq(deliveryLines.companyId, ctx.companyId)));
  const [origin] = row.originDeliveryId
    ? await ctx.tx
        .select({ number: deliveries.number })
        .from(deliveries)
        .where(and(eq(deliveries.id, row.originDeliveryId), eq(deliveries.companyId, ctx.companyId)))
    : [];
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
    originDeliveryId: row.originDeliveryId,
    originNumber: origin?.number ?? null,
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
