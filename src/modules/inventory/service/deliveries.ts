import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { nextNumber } from '@/core/sequences';
import { deliveries, deliveryLines, type Delivery } from '../schema';
import { closeReservations, aggregateLines, type ReservableLine } from './reservations';
import { fromMilli } from './quantity';
import { moveLines } from './moves';
import { ensureDefaultWarehouse } from './warehouses';

export const DELIVERY_SOURCE_ENTITY = 'inventory.delivery';

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
