import { and, eq, sql } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { ok, type Result } from '@/core/result';
import { stockReservations } from '../schema';
import { fromMilli, toMilli } from './quantity';

export interface ReservableLine {
  productId: string | null;
  quantity: string;
}

/**
 * Sums document lines per product in thousandths. Skips lines without a product and
 * lines whose quantity is not a positive number. Pure, so it is unit-tested.
 */
export function aggregateLines(lines: readonly ReservableLine[]): Map<string, bigint> {
  const totals = new Map<string, bigint>();
  for (const line of lines) {
    if (!line.productId) continue;
    const milli = toMilli(line.quantity);
    if (milli === null || milli <= 0n) continue;
    totals.set(line.productId, (totals.get(line.productId) ?? 0n) + milli);
  }
  return totals;
}

/**
 * Reserves stock for a source document, one active reservation per product. Products that
 * already have an active reservation for this source are skipped, so redelivery creates nothing.
 * No permission check: called from event handlers, like moveLines.
 */
export async function reserveLines(
  ctx: Ctx,
  input: {
    lines: readonly ReservableLine[];
    locationId: string;
    sourceEntity: string;
    sourceId: string;
  },
): Promise<Result<{ created: number }>> {
  let created = 0;
  for (const [productId, milli] of aggregateLines(input.lines)) {
    const [existing] = await ctx.tx
      .select({ id: stockReservations.id })
      .from(stockReservations)
      .where(
        and(
          eq(stockReservations.companyId, ctx.companyId),
          eq(stockReservations.sourceEntity, input.sourceEntity),
          eq(stockReservations.sourceId, input.sourceId),
          eq(stockReservations.productId, productId),
          eq(stockReservations.state, 'active'),
        ),
      );
    if (existing) continue;
    await ctx.tx.insert(stockReservations).values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      productId,
      locationId: input.locationId,
      quantity: fromMilli(milli),
      sourceEntity: input.sourceEntity,
      sourceId: input.sourceId,
      state: 'active',
    });
    created += 1;
  }
  return ok({ created });
}

/** Moves the active reservations of a source to a new state (released or consumed). Idempotent. */
export async function closeReservations(
  ctx: Ctx,
  input: { sourceEntity: string; sourceId: string; state: 'released' | 'consumed' },
): Promise<Result<{ updated: number }>> {
  const rows = await ctx.tx
    .update(stockReservations)
    .set({ state: input.state, updatedAt: sql`now()` })
    .where(
      and(
        eq(stockReservations.companyId, ctx.companyId),
        eq(stockReservations.sourceEntity, input.sourceEntity),
        eq(stockReservations.sourceId, input.sourceId),
        eq(stockReservations.state, 'active'),
      ),
    )
    .returning({ id: stockReservations.id });
  return ok({ updated: rows.length });
}

/** Active reserved quantity per product, in thousandths. Used to compute available quantity. */
export async function activeReservedByProduct(ctx: Ctx): Promise<Map<string, bigint>> {
  const rows = await ctx.tx
    .select({ productId: stockReservations.productId, quantity: stockReservations.quantity })
    .from(stockReservations)
    .where(and(eq(stockReservations.companyId, ctx.companyId), eq(stockReservations.state, 'active')));
  const totals = new Map<string, bigint>();
  for (const r of rows) totals.set(r.productId, (totals.get(r.productId) ?? 0n) + (toMilli(r.quantity) ?? 0n));
  return totals;
}
