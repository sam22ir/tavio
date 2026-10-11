import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { OWNER_PERMS } from '@/core/perms';
import { products, uoms } from '@/modules/products/schema';
import { deliveries, stockMoves, stockReservations } from '../schema';
import { closeReservations, reserveLines } from '../service/reservations';
import { createDraftDelivery, returnDoneDeliveriesForSource, setDeliverySignedBy, validateDelivery, sourceDeliveryStatus } from '../service/deliveries';
import { moveLines } from '../service/moves';
import { stockLevels } from '../service/stock';
import { ensureDefaultWarehouse } from '../service/warehouses';

loadDevEnv();

const db = getDb();
const createdCompanies: string[] = [];
const CONTRACT = 'credit_sales.contract';

async function fixture(): Promise<{ args: TenantArgs; goodsId: string; serviceId: string }> {
  const companyId = randomUUID();
  const userId = randomUUID();
  createdCompanies.push(companyId);
  await db.insert(companies).values({ id: companyId, legalName: 'Credit Stock SARL', displayName: 'CreditStock' });
  await db.insert(users).values({ id: userId, name: 'credit stock', email: `cstock-${userId}@test.invalid` });
  const [unitRow] = await db.select({ id: uoms.id }).from(uoms).where(eq(uoms.code, 'unit')).limit(1);
  if (!unitRow) throw new Error('seeded uom "unit" missing: run scripts/seed-global.ts');
  const goodsId = randomUUID();
  const serviceId = randomUUID();
  await db.insert(products).values([
    { id: goodsId, companyId, name: 'Fridge', kind: 'goods', trackStock: true, uomId: unitRow.id, salePriceCents: BigInt(0), costCents: BigInt(0) },
    { id: serviceId, companyId, name: 'Installation', kind: 'service', trackStock: false, uomId: unitRow.id, salePriceCents: BigInt(0), costCents: BigInt(0) },
  ]);
  return { args: { userId, companyId, perms: OWNER_PERMS, locale: 'en' }, goodsId, serviceId };
}

/** Stock on hand of one product, in units, across internal locations. */
async function onHand(args: TenantArgs, productId: string): Promise<number> {
  return withTenant(args, async (ctx) => {
    const levels = await stockLevels(ctx);
    if (!levels.ok) throw new Error(levels.error.message);
    const row = levels.value.find((r) => r.productId === productId);
    return row ? Number(row.onHand) : 0;
  });
}

afterAll(async () => {
  for (const id of createdCompanies) {
    await db.delete(stockMoves).where(eq(stockMoves.companyId, id));
    await db.delete(deliveries).where(eq(deliveries.companyId, id));
    await db.delete(stockReservations).where(eq(stockReservations.companyId, id));
  }
});

describe.skipIf(!process.env.TAVIO_W5_DB)('credit contract deliveries move stock (database)', () => {
  it('validating a delivery reduces on-hand and consumes the reservation', async () => {
    const { args, goodsId, serviceId } = await fixture();
    const sourceId = randomUUID();
    await withTenant(args, async (ctx) => {
      const wh = await ensureDefaultWarehouse(ctx);
      const receipt = await moveLines(ctx, {
        lines: [{ productId: goodsId, quantity: '10' }],
        sourceEntity: 'test.receipt',
        sourceId: randomUUID(),
        reference: 'RC-TEST',
        fromLocationId: wh.supplierLocationId,
        toLocationId: wh.internalLocationId,
        post: true,
      });
      expect(receipt.ok).toBe(true);
    });
    const lines = [
      { productId: goodsId, quantity: '4' },
      { productId: serviceId, quantity: '1' },
    ];
    await withTenant(args, async (ctx) => {
      const wh = await ensureDefaultWarehouse(ctx);
      await reserveLines(ctx, { lines, locationId: wh.internalLocationId, sourceEntity: CONTRACT, sourceId });
      const draft = await createDraftDelivery(ctx, { partnerId: randomUUID(), sourceEntity: CONTRACT, sourceId, lines });
      expect(draft.ok && draft.value.created).toBe(true);
      const id = draft.ok ? draft.value.deliveryId as string : '';
      expect((await sourceDeliveryStatus(ctx, { sourceEntity: CONTRACT, sourceId })).ok).toBe(true);
      await setDeliverySignedBy(ctx, { deliveryId: id, signedByName: 'Client' });
      const validated = await validateDelivery(ctx, id);
      expect(validated.ok).toBe(true);
      expect(validated.ok && validated.value.moves).toBe(1);
    });
    expect(await onHand(args, goodsId)).toBe(6);
    expect(await onHand(args, serviceId)).toBe(0);
    await withTenant(args, async (ctx) => {
      const [res] = await ctx.tx.select().from(stockReservations).where(eq(stockReservations.sourceId, sourceId));
      expect(res?.state).toBe('consumed');
      const levels = await stockLevels(ctx);
      expect(levels.ok && Number(levels.value.find((r) => r.productId === goodsId)?.available)).toBe(6);
    });
  });

  it('cancelling after delivery returns the delivered goods to stock', async () => {
    const { args, goodsId } = await fixture();
    const sourceId = randomUUID();
    const lines = [{ productId: goodsId, quantity: '3' }];
    await withTenant(args, async (ctx) => {
      const wh = await ensureDefaultWarehouse(ctx);
      await moveLines(ctx, {
        lines: [{ productId: goodsId, quantity: '5' }],
        sourceEntity: 'test.receipt',
        sourceId: randomUUID(),
        reference: 'RC-TEST-2',
        fromLocationId: wh.supplierLocationId,
        toLocationId: wh.internalLocationId,
        post: true,
      });
      await reserveLines(ctx, { lines, locationId: wh.internalLocationId, sourceEntity: CONTRACT, sourceId });
      const draft = await createDraftDelivery(ctx, { partnerId: randomUUID(), sourceEntity: CONTRACT, sourceId, lines });
      const id = draft.ok && draft.value.deliveryId ? draft.value.deliveryId : '';
      await setDeliverySignedBy(ctx, { deliveryId: id, signedByName: 'Client' });
      await validateDelivery(ctx, id);
    });
    expect(await onHand(args, goodsId)).toBe(2);
    await withTenant(args, async (ctx) => {
      await closeReservations(ctx, { sourceEntity: CONTRACT, sourceId, state: 'released' });
      const returned = await returnDoneDeliveriesForSource(ctx, { sourceEntity: CONTRACT, sourceId });
      expect(returned).toEqual({ ok: true, value: { returned: 1 } });
      const again = await returnDoneDeliveriesForSource(ctx, { sourceEntity: CONTRACT, sourceId });
      expect(again.ok).toBe(true);
    });
    expect(await onHand(args, goodsId)).toBe(5);
  });
});
