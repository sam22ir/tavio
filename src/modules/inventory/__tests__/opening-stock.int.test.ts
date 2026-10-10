import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { OWNER_PERMS } from '@/core/perms';
import { accounts, journalLines } from '@/modules/accounting/schema';
import { products, uoms } from '@/modules/products/schema';
import { stockLocations, stockMoves } from '../schema';
import '@/modules/accounting/events';
import '../events';
import { createAdjustment } from '../service/adjustments';
import { ensureDefaultWarehouse } from '../service/warehouses';

loadDevEnv();

const db = getDb();
const createdCompanies: string[] = [];

async function fixture(): Promise<{ args: TenantArgs; productId: string }> {
  const companyId = randomUUID();
  const userId = randomUUID();
  const productId = randomUUID();
  createdCompanies.push(companyId);
  await db.insert(companies).values({ id: companyId, legalName: 'Opening Stock SARL', displayName: 'Opening' });
  await db.insert(users).values({ id: userId, name: 'opening stock test', email: `open-${userId}@test.invalid` });
  const [unitRow] = await db.select({ id: uoms.id }).from(uoms).where(eq(uoms.code, 'unit')).limit(1);
  if (!unitRow) throw new Error('seeded uom "unit" missing: run scripts/seed-global.ts');
  await db.insert(products).values({
    id: productId,
    companyId,
    name: 'Opening widget',
    kind: 'goods',
    uomId: unitRow.id,
    salePriceCents: BigInt(0),
    costCents: BigInt(0),
  });
  return { args: { userId, companyId, perms: OWNER_PERMS, locale: 'fr' }, productId };
}

afterAll(async () => {
  for (const id of createdCompanies) {
    await db.delete(journalLines).where(eq(journalLines.companyId, id));
    await db.delete(stockMoves).where(eq(stockMoves.companyId, id));
    await db.delete(stockLocations).where(eq(stockLocations.companyId, id));
  }
});

describe.skipIf(!process.env.TAVIO_W5_DB)('opening stock (database)', () => {
  it('sets the CMUP cost and posts Dr 30 / Cr 101 flagged to verify', async () => {
    const { args, productId } = await fixture();
    const warehouse = await withTenant(args, (ctx) => ensureDefaultWarehouse(ctx));

    const posted = await withTenant(args, (ctx) =>
      createAdjustment(ctx, {
        productId,
        locationId: warehouse.internalLocationId,
        countedQty: '10',
        unitCostCents: BigInt(1500),
        opening: true,
      }),
    );
    expect(posted.ok).toBe(true);

    const [product] = await db.select({ avg: products.avgCostCents }).from(products).where(eq(products.id, productId));
    expect(product?.avg).toBe(BigInt(1500));

    const moves = await db.select({ source: stockMoves.sourceEntity, value: stockMoves.valueCents })
      .from(stockMoves).where(eq(stockMoves.productId, productId));
    expect(moves).toHaveLength(1);
    expect(moves[0]?.source).toBe('inventory.opening');

    const lines = await db
      .select({ code: accounts.code, debit: journalLines.debitCents, credit: journalLines.creditCents, label: journalLines.label })
      .from(journalLines)
      .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
      .where(eq(journalLines.companyId, args.companyId));
    expect(lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: '30', debit: BigInt(15000), credit: BigInt(0) }),
      expect.objectContaining({ code: '101', debit: BigInt(0), credit: BigInt(15000) }),
    ]));
    expect(lines.every((l) => (l.code === '30' || l.code === '101') ? (l.label ?? '').includes('à vérifier') : true)).toBe(true);
  });
});
