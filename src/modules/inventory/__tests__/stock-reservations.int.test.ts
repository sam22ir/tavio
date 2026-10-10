import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { OWNER_PERMS } from '@/core/perms';
import { products, uoms } from '@/modules/products/schema';
import { deliveries, stockReservations } from '../schema';
import { closeReservations, reserveLines } from '../service/reservations';
import { createDraftDelivery } from '../service/deliveries';
import { ensureDefaultWarehouse } from '../service/warehouses';

loadDevEnv();

const db = getDb();
const createdCompanies: string[] = [];

async function fixture(): Promise<{ args: TenantArgs; productId: string }> {
  const companyId = randomUUID();
  const userId = randomUUID();
  const productId = randomUUID();
  createdCompanies.push(companyId);
  await db.insert(companies).values({ id: companyId, legalName: 'Stock Test SARL', displayName: 'Stock' });
  await db.insert(users).values({ id: userId, name: 'stock test', email: `stock-${userId}@test.invalid` });
  const [unitRow] = await db.select({ id: uoms.id }).from(uoms).where(eq(uoms.code, 'unit')).limit(1);
  if (!unitRow) throw new Error('seeded uom "unit" missing: run scripts/seed-global.ts');
  await db.insert(products).values({
    id: productId,
    companyId,
    name: 'Reserved widget',
    kind: 'goods',
    uomId: unitRow.id,
    salePriceCents: BigInt(0),
    costCents: BigInt(0),
  });
  return { args: { userId, companyId, perms: OWNER_PERMS, locale: 'en' }, productId };
}

afterAll(async () => {
  for (const id of createdCompanies) {
    await db.delete(deliveries).where(eq(deliveries.companyId, id));
    await db.delete(stockReservations).where(eq(stockReservations.companyId, id));
  }
});

describe.skipIf(!process.env.TAVIO_W5_DB)('stock reservations and deliveries (database)', () => {
  it('reserve is idempotent and release closes the reservation', async () => {
    const { args, productId } = await fixture();
    const sourceId = randomUUID();
    await withTenant(args, async (ctx) => {
      const wh = await ensureDefaultWarehouse(ctx);
      const lines = [{ productId, quantity: '2' }];
      const first = await reserveLines(ctx, { lines, locationId: wh.internalLocationId, sourceEntity: 'credit_sales.contract', sourceId });
      const second = await reserveLines(ctx, { lines, locationId: wh.internalLocationId, sourceEntity: 'credit_sales.contract', sourceId });
      expect(first).toEqual({ ok: true, value: { created: 1 } });
      expect(second).toEqual({ ok: true, value: { created: 0 } });
      const released = await closeReservations(ctx, { sourceEntity: 'credit_sales.contract', sourceId, state: 'released' });
      expect(released).toEqual({ ok: true, value: { updated: 1 } });
    });
  });

  it('a delivery is created once per source document', async () => {
    const { args, productId } = await fixture();
    const sourceId = randomUUID();
    await withTenant(args, async (ctx) => {
      const partnerId = randomUUID();
      const input = { partnerId, sourceEntity: 'credit_sales.contract', sourceId, lines: [{ productId, quantity: '1' }] };
      const a = await createDraftDelivery(ctx, input);
      const b = await createDraftDelivery(ctx, input);
      expect(a.ok && a.value.created).toBe(true);
      expect(b.ok && b.value.created).toBe(false);
    });
  });

  it('company B cannot see company A reservations', async () => {
    const a = await fixture();
    const b = await fixture();
    const sourceId = randomUUID();
    await withTenant(a.args, async (ctx) => {
      const wh = await ensureDefaultWarehouse(ctx);
      await reserveLines(ctx, { lines: [{ productId: a.productId, quantity: '1' }], locationId: wh.internalLocationId, sourceEntity: 'credit_sales.contract', sourceId });
    });
    const seen = await withTenant(b.args, (ctx) => ctx.tx.select().from(stockReservations));
    expect(seen).toHaveLength(0);
  });
});
