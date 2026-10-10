// Stock valuation report: quantity on hand, CMUP unit cost and value per product, with a total.
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { ok, type Result } from '@/core/result';
import { products } from '@/modules/products/schema';
import { fromMilli, toMilli } from './quantity';
import { onHandByLocation } from './stock';
import { roundDiv } from './valuation';

export interface ValuationRow {
  productId: string;
  productName: string;
  onHand: string;
  /** Average unit cost in cents (products.avg_cost_cents, falling back to cost_cents). */
  avgCostCents: string;
  /** On hand x average cost, in cents. */
  valueCents: string;
}

export interface ValuationReport {
  rows: ValuationRow[];
  totalCents: string;
}

/**
 * Valuation per product at the company's average cost. The average is company-wide (CMUP), so a
 * warehouse filter changes quantities and values but not the unit cost.
 */
export async function stockValuation(
  ctx: Ctx,
  filter: { warehouseId?: string } = {},
): Promise<Result<ValuationReport>> {
  const perm = requirePerm(ctx, 'inventory.move.read');
  if (!perm.ok) return perm;

  const levels = await onHandByLocation(ctx, { warehouseId: filter.warehouseId });
  const onHand = new Map<string, bigint>();
  for (const r of levels) onHand.set(r.productId, (onHand.get(r.productId) ?? 0n) + (toMilli(r.quantity) ?? 0n));
  const ids = [...onHand.keys()].filter((id) => onHand.get(id) !== 0n);
  if (ids.length === 0) return ok({ rows: [], totalCents: '0' });

  const found = await ctx.tx
    .select({
      id: products.id,
      name: products.name,
      avgCostCents: products.avgCostCents,
      costCents: products.costCents,
    })
    .from(products)
    .where(and(eq(products.companyId, ctx.companyId), inArray(products.id, ids)))
    .orderBy(asc(products.name));

  let total = 0n;
  const rows: ValuationRow[] = found.map((p) => {
    const milli = onHand.get(p.id) ?? 0n;
    const avg = p.avgCostCents ?? p.costCents;
    const value = milli < 0n ? -roundDiv(-milli * avg, 1000n) : roundDiv(milli * avg, 1000n);
    total += value;
    return {
      productId: p.id,
      productName: p.name,
      onHand: fromMilli(milli),
      avgCostCents: avg.toString(),
      valueCents: value.toString(),
    };
  });
  return ok({ rows, totalCents: total.toString() });
}
