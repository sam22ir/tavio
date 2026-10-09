import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { emit } from '@/core/events';
import { OWNER_PERMS } from '@/core/perms';
import { products, uoms } from '@/modules/products/schema';
import { stockLocations, stockMoves } from '../schema';
import '../events';
import { createAdjustment } from '../service/adjustments';
import { cancelMove, createMove, validateMove } from '../service/moves';
import { lowStock, createReorderRule, stockLevels } from '../service/stock';
import { ensureDefaultWarehouse } from '../service/warehouses';

loadDevEnv();

const db = getDb();
const createdCompanies: string[] = [];

async function fixture(): Promise<{ args: TenantArgs; productId: string; uomId: string }> {
  const companyId = randomUUID();
  const userId = randomUUID();
  const uomId = randomUUID();
  const productId = randomUUID();
  createdCompanies.push(companyId);
  await db.insert(companies).values({ id: companyId, legalName: 'Inv Test SARL', displayName: 'Inv' });
  await db.insert(users).values({ id: userId, name: 'inventory test', email: `inv-${userId}@test.invalid` });
  await db.insert(uoms).values({ id: uomId, code: `pc-${uomId.slice(0, 8)}`, nameFr: 'Pièce', category: 'unit', factorToRef: '1', isReference: false });
  await db.insert(products).values({
    id: productId,
    companyId,
    name: 'Widget',
    kind: 'goods',
    uomId,
    salePriceCents: BigInt(0),
    costCents: BigInt(0),
  });
  return { args: { userId, companyId, perms: OWNER_PERMS, locale: 'en' }, productId, uomId };
}

afterAll(async () => {
  for (const id of createdCompanies) {
    await db.delete(stockMoves).where(eq(stockMoves.companyId, id));
    await db.delete(stockLocations).where(eq(stockLocations.companyId, id));
  }
});

describe.skipIf(!process.env.TAVIO_W5_DB)('inventory service (database)', () => {
  it('ensureDefaultWarehouse is idempotent', async () => {
    const { args } = await fixture();
    const [a, b] = await withTenant(args, async (ctx) => [
      await ensureDefaultWarehouse(ctx),
      await ensureDefaultWarehouse(ctx),
    ]);
    expect(b).toEqual(a);
  });

  it('sales confirmation creates draft delivery moves once per product', async () => {
    const { args, productId } = await fixture();
    const orderId = randomUUID();
    const payload = {
      orderId,
      partnerId: randomUUID(),
      number: 'SO-1',
      lines: [
        { productId, quantity: '2' },
        { productId, quantity: '1.5' },
        { productId: null, quantity: '9' },
      ],
    };
    await withTenant(args, (ctx) => emit(ctx, { name: 'sales.order.confirmed', payload }));
    await withTenant(args, (ctx) => emit(ctx, { name: 'sales.order.confirmed', payload }));
    const rows = await db.select().from(stockMoves).where(eq(stockMoves.sourceId, orderId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe('draft');
    expect(rows[0]?.quantity).toBe('3.500');
  });

  it('receipts are posted and change stock; adjustments set the counted quantity', async () => {
    const { args, productId } = await fixture();
    await withTenant(args, (ctx) =>
      emit(ctx, {
        name: 'purchases.order.received',
        payload: { orderId: randomUUID(), number: 'PO-1', lines: [{ productId, quantity: '5' }] },
      }),
    );
    const levels = await withTenant(args, (ctx) => stockLevels(ctx));
    expect(levels.ok && levels.value.find((r) => r.productId === productId)?.onHand).toBe('5.000');

    const wh = await withTenant(args, (ctx) => ensureDefaultWarehouse(ctx));
    const result = await withTenant(args, (ctx) =>
      createAdjustment(ctx, { productId, locationId: wh.internalLocationId, countedQty: '3' }),
    );
    expect(result.ok && result.value.difference).toBe('-2.000');
  });

  it('validates a draft move once and refuses to cancel a done move', async () => {
    const { args, productId } = await fixture();
    const wh = await withTenant(args, (ctx) => ensureDefaultWarehouse(ctx));
    const created = await withTenant(args, (ctx) =>
      createMove(ctx, { productId, quantity: '1', fromLocationId: wh.internalLocationId, toLocationId: wh.customerLocationId }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect((await withTenant(args, (ctx) => validateMove(ctx, created.value.moveId))).ok).toBe(true);
    expect((await withTenant(args, (ctx) => validateMove(ctx, created.value.moveId))).ok).toBe(false);
    expect((await withTenant(args, (ctx) => cancelMove(ctx, created.value.moveId))).ok).toBe(false);
  });

  it('reports low stock below the rule minimum', async () => {
    const { args, productId } = await fixture();
    const wh = await withTenant(args, (ctx) => ensureDefaultWarehouse(ctx));
    await withTenant(args, (ctx) =>
      createReorderRule(ctx, { productId, warehouseId: wh.warehouseId, minQty: '10', maxQty: '20' }),
    );
    const low = await withTenant(args, (ctx) => lowStock(ctx));
    expect(low.ok && low.value.find((r) => r.productId === productId)?.toOrder).toBe('20.000');
  });
});
