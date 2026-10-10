import { and, asc, eq, sql } from 'drizzle-orm';
import { unionAll } from 'drizzle-orm/pg-core';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { products } from '@/modules/products/schema';
import { reorderRules, stockLocations, stockMoves, warehouses } from '../schema';
import { fromMilli, parsePositiveQty, toMilli } from './quantity';
import { activeReservedByProduct } from './reservations';

export interface OnHandRow {
  productId: string;
  locationId: string;
  warehouseId: string;
  quantity: string;
}

export interface StockLevelRow {
  productId: string;
  productName: string;
  onHand: string;
  /** Quantity held by active reservations. */
  reserved: string;
  /** On hand minus reserved. */
  available: string;
}

export interface LowStockRow {
  reorderRuleId: string;
  productId: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  onHand: string;
  minQty: string;
  maxQty: string | null;
  toOrder: string;
}

export interface ReorderRuleInput {
  productId: string;
  warehouseId: string;
  minQty: string;
  maxQty?: string;
}

/**
 * Stock on hand per (product, internal location), from done moves. Each done move adds its
 * quantity to its destination and subtracts it from its origin. Only internal locations count,
 * so receipts and deliveries change stock and transfers between internal locations net to zero.
 * There is no quants table, so this query is the source of truth.
 */
export async function onHandByLocation(
  ctx: Ctx,
  filter: { productId?: string; warehouseId?: string } = {},
): Promise<OnHandRow[]> {
  const inbound = ctx.tx
    .select({
      productId: stockMoves.productId,
      locationId: stockMoves.toLocationId,
      quantity: sql<string>`${stockMoves.quantity}`.as('quantity'),
    })
    .from(stockMoves)
    .where(and(eq(stockMoves.companyId, ctx.companyId), eq(stockMoves.state, 'done')));
  const outbound = ctx.tx
    .select({
      productId: stockMoves.productId,
      locationId: stockMoves.fromLocationId,
      quantity: sql<string>`-${stockMoves.quantity}`.as('quantity'),
    })
    .from(stockMoves)
    .where(and(eq(stockMoves.companyId, ctx.companyId), eq(stockMoves.state, 'done')));
  const legs = unionAll(inbound, outbound).as('legs');

  const rows = await ctx.tx
    .select({
      productId: legs.productId,
      locationId: legs.locationId,
      warehouseId: stockLocations.warehouseId,
      quantity: sql<string>`sum(${legs.quantity})`,
    })
    .from(legs)
    .innerJoin(stockLocations, and(eq(stockLocations.id, legs.locationId), eq(stockLocations.type, 'internal')))
    .where(
      and(
        filter.productId ? eq(legs.productId, filter.productId) : undefined,
        filter.warehouseId ? eq(stockLocations.warehouseId, filter.warehouseId) : undefined,
      ),
    )
    .groupBy(legs.productId, legs.locationId, stockLocations.warehouseId);

  return rows
    .filter((r): r is typeof r & { warehouseId: string } => r.warehouseId !== null)
    .map((r) => ({ productId: r.productId, locationId: r.locationId, warehouseId: r.warehouseId, quantity: r.quantity }));
}

/** Stock on hand for every product that has moved, summed over internal locations. */
export async function stockLevels(ctx: Ctx): Promise<Result<StockLevelRow[]>> {
  const perm = requirePerm(ctx, 'inventory.move.read');
  if (!perm.ok) return perm;
  const rows = await onHandByLocation(ctx);
  const totals = new Map<string, bigint>();
  for (const r of rows) totals.set(r.productId, (totals.get(r.productId) ?? 0n) + (toMilli(r.quantity) ?? 0n));
  const reserved = await activeReservedByProduct(ctx);
  const listed = new Set([...totals.keys(), ...reserved.keys()]);
  if (listed.size === 0) return ok([]);

  const names = await ctx.tx
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.companyId, ctx.companyId))
    .orderBy(asc(products.name));
  return ok(
    names
      .filter((p) => listed.has(p.id))
      .map((p) => {
        const onHand = totals.get(p.id) ?? 0n;
        const held = reserved.get(p.id) ?? 0n;
        return {
          productId: p.id,
          productName: p.name,
          onHand: fromMilli(onHand),
          reserved: fromMilli(held),
          available: fromMilli(onHand - held),
        };
      }),
  );
}

/** Reorder rules whose on-hand quantity in the rule's warehouse is below min_qty. */
export async function lowStock(ctx: Ctx): Promise<Result<LowStockRow[]>> {
  const perm = requirePerm(ctx, 'inventory.reorder.read');
  if (!perm.ok) return perm;
  const rules = await ctx.tx
    .select({
      id: reorderRules.id,
      productId: reorderRules.productId,
      productName: products.name,
      warehouseId: reorderRules.warehouseId,
      warehouseName: warehouses.name,
      minQty: reorderRules.minQty,
      maxQty: reorderRules.maxQty,
    })
    .from(reorderRules)
    .innerJoin(products, eq(products.id, reorderRules.productId))
    .innerJoin(warehouses, eq(warehouses.id, reorderRules.warehouseId))
    .where(eq(reorderRules.companyId, ctx.companyId))
    .orderBy(asc(products.name));

  const onHand = new Map<string, bigint>();
  for (const r of await onHandByLocation(ctx)) {
    const key = `${r.productId}|${r.warehouseId}`;
    onHand.set(key, (onHand.get(key) ?? 0n) + (toMilli(r.quantity) ?? 0n));
  }

  const result: LowStockRow[] = [];
  for (const rule of rules) {
    const current = onHand.get(`${rule.productId}|${rule.warehouseId}`) ?? 0n;
    const min = toMilli(rule.minQty) ?? 0n;
    if (current >= min) continue;
    const max = rule.maxQty === null ? null : toMilli(rule.maxQty);
    const target = max ?? min;
    result.push({
      reorderRuleId: rule.id,
      productId: rule.productId,
      productName: rule.productName,
      warehouseId: rule.warehouseId,
      warehouseName: rule.warehouseName,
      onHand: fromMilli(current),
      minQty: rule.minQty,
      maxQty: rule.maxQty,
      toOrder: fromMilli(target - current),
    });
  }
  return ok(result);
}

export async function createReorderRule(ctx: Ctx, input: ReorderRuleInput): Promise<Result<{ ruleId: string }>> {
  const perm = requirePerm(ctx, 'inventory.reorder.write');
  if (!perm.ok) return perm;
  const minMilli = toMilli(input.minQty);
  if (minMilli === null || minMilli < 0n) return err('VALIDATION', 'Invalid minimum quantity');
  const minQty = fromMilli(minMilli);
  let maxQty: string | null = null;
  if (input.maxQty !== undefined && input.maxQty.trim() !== '') {
    maxQty = parsePositiveQty(input.maxQty);
    if (maxQty === null || (toMilli(maxQty) ?? 0n) < minMilli) {
      return err('VALIDATION', 'Invalid maximum quantity');
    }
  }

  const [dup] = await ctx.tx
    .select({ id: reorderRules.id })
    .from(reorderRules)
    .where(
      and(
        eq(reorderRules.companyId, ctx.companyId),
        eq(reorderRules.productId, input.productId),
        eq(reorderRules.warehouseId, input.warehouseId),
      ),
    );
  if (dup) return err('CONFLICT', 'A rule already exists for this product and warehouse');

  const [row] = await ctx.tx
    .insert(reorderRules)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      productId: input.productId,
      warehouseId: input.warehouseId,
      minQty,
      maxQty,
    })
    .returning({ id: reorderRules.id });
  if (!row) throw new Error('reorder rule insert returned no row');
  await audit(ctx, { entity: 'inventory.reorder_rule', recordId: row.id, action: 'create', after: { ...input, minQty, maxQty } });
  return ok({ ruleId: row.id });
}
