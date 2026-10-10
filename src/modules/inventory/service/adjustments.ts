import { and, eq } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { nextNumber } from '@/core/sequences';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { products } from '@/modules/products/schema';
import { stockLocations, stockMoves } from '../schema';
import { onHandByLocation } from './stock';
import { fromMilli, parseCountedQty, toMilli } from './quantity';
import { ensureDefaultWarehouse } from './warehouses';
import { postMove } from './moves';

/** Source tag of the moves created by opening-stock imports. Accounting books them against 101. */
export const OPENING_STOCK_SOURCE = 'inventory.opening';

export interface AdjustmentInput {
  productId: string;
  locationId: string;
  countedQty: string;
  /** Unit cost in centimes for a gain. It enters the CMUP average. Required for opening stock. */
  unitCostCents?: bigint;
  /** Marks the move as opening stock, so accounting books Dr 30 / Cr 101 instead of the gain account. */
  opening?: boolean;
}

/**
 * Inventory adjustment: sets the on-hand quantity of a product at an internal location to the
 * counted quantity. The difference becomes a done move against the company's inventory_loss
 * location (gain: loss -> location, loss: location -> loss). Returns moveId null when nothing changed.
 */
export async function createAdjustment(
  ctx: Ctx,
  input: AdjustmentInput,
): Promise<Result<{ moveId: string | null; reference: string | null; difference: string }>> {
  const perm = requirePerm(ctx, 'inventory.adjustment.write');
  if (!perm.ok) return perm;
  const counted = parseCountedQty(input.countedQty);
  if (counted === null) return err('VALIDATION', 'Invalid counted quantity');

  const [location] = await ctx.tx
    .select()
    .from(stockLocations)
    .where(and(eq(stockLocations.id, input.locationId), eq(stockLocations.companyId, ctx.companyId)));
  if (!location || location.type !== 'internal') return err('NOT_FOUND', 'Internal stock location not found');

  const [product] = await ctx.tx
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, input.productId), eq(products.companyId, ctx.companyId)));
  if (!product) return err('NOT_FOUND', 'Product not found');

  const current = (await onHandByLocation(ctx, { productId: input.productId }))
    .filter((r) => r.locationId === location.id)
    .reduce((acc, r) => acc + (toMilli(r.quantity) ?? 0n), 0n);
  const difference = (toMilli(counted) ?? 0n) - current;
  if (difference === 0n) return ok({ moveId: null, reference: null, difference: '0.000' });

  const lossLocation = await ensureDefaultWarehouse(ctx);
  const quantity = fromMilli(difference < 0n ? -difference : difference);
  const [move] = await ctx.tx
    .insert(stockMoves)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      reference: await nextNumber(ctx, 'inventory.move', { prefix: 'MV{YYYY}/', padding: 5 }),
      productId: input.productId,
      quantity,
      fromLocationId: difference > 0n ? lossLocation.inventoryLossLocationId : location.id,
      toLocationId: difference > 0n ? location.id : lossLocation.inventoryLossLocationId,
      unitCostCents: difference > 0n && input.unitCostCents !== undefined ? input.unitCostCents : null,
      sourceEntity: input.opening ? OPENING_STOCK_SOURCE : null,
      state: 'draft',
    })
    .returning({ id: stockMoves.id, reference: stockMoves.reference });
  if (!move) throw new Error('adjustment move insert returned no row');

  const posted = await postMove(ctx, move.id);
  if (!posted.ok) return posted;
  await audit(ctx, {
    entity: 'inventory.move',
    recordId: move.id,
    action: 'adjust',
    after: { productId: input.productId, locationId: location.id, counted, difference: fromMilli(difference) },
  });
  return ok({ moveId: move.id, reference: move.reference, difference: fromMilli(difference) });
}
