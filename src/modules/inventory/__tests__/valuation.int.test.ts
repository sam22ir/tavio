import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { emit } from '@/core/events';
import { OWNER_PERMS } from '@/core/perms';
import { journalEntries, journalLines, accounts } from '@/modules/accounting/schema';
import '@/modules/accounting/events';
import { products, uoms } from '@/modules/products/schema';
import '../events';
import { createMove, validateMove } from '../service/moves';
import { ensureDefaultWarehouse } from '../service/warehouses';

loadDevEnv();

const db = getDb();
const createdCompanies: string[] = [];

async function fixture(): Promise<{ args: TenantArgs; productId: string }> {
  const companyId = randomUUID();
  const userId = randomUUID();
  const productId = randomUUID();
  createdCompanies.push(companyId);
  await db.insert(companies).values({ id: companyId, legalName: 'Val Test SARL', displayName: 'Val' });
  await db.insert(users).values({ id: userId, name: 'valuation test', email: `val-${userId}@test.invalid` });
  const [unitRow] = await db.select({ id: uoms.id }).from(uoms).where(eq(uoms.code, 'unit')).limit(1);
  if (!unitRow) throw new Error('seeded uom "unit" missing: run scripts/seed-global.ts');
  await db.insert(products).values({
    id: productId,
    companyId,
    name: 'Valued widget',
    kind: 'goods',
    uomId: unitRow.id,
    salePriceCents: BigInt(0),
    costCents: BigInt(0),
    trackStock: true,
  });
  return { args: { userId, companyId, perms: OWNER_PERMS, locale: 'en' }, productId };
}

describe.skipIf(!process.env.TAVIO_W5_DB)('stock valuation (database)', () => {
  afterAll(async () => {
    for (const id of createdCompanies) await db.delete(companies).where(eq(companies.id, id));
  });

  it('averages receipts at purchase cost and books the delivery at the average', async () => {
    const { args, productId } = await fixture();
    const orderId = randomUUID();

    await withTenant(args, async (ctx) => {
      await emit(ctx, {
        name: 'purchases.order.received',
        payload: { orderId, number: 'PO-1', lines: [{ productId, quantity: '10', unitCostCents: '100' }] },
      });
      await emit(ctx, {
        name: 'purchases.order.received',
        payload: { orderId: randomUUID(), number: 'PO-2', lines: [{ productId, quantity: '10', unitCostCents: '200' }] },
      });
    });

    const [p] = await db.select({ avg: products.avgCostCents }).from(products).where(eq(products.id, productId));
    expect(p?.avg).toBe(BigInt(150));

    await withTenant(args, async (ctx) => {
      const wh = await ensureDefaultWarehouse(ctx);
      const moved = await createMove(ctx, {
        productId,
        quantity: '5',
        fromLocationId: wh.internalLocationId,
        toLocationId: wh.customerLocationId,
      });
      if (!moved.ok) throw new Error(moved.error.message);
      const posted = await validateMove(ctx, moved.value.moveId);
      if (!posted.ok) throw new Error(posted.error.message);
    });

    const [entry] = await db
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
      .where(eq(journalEntries.companyId, args.companyId))
      .limit(1);
    expect(entry).toBeDefined();
    const lines = await db
      .select({ code: accounts.code, debit: journalLines.debitCents, credit: journalLines.creditCents })
      .from(journalLines)
      .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
      .where(eq(journalLines.entryId, entry?.id ?? ''));
    const cogs = lines.find((l) => l.code === '600');
    const stock = lines.find((l) => l.code === '30' && l.credit > BigInt(0));
    expect(cogs?.debit).toBe(BigInt(750));
    expect(stock?.credit).toBe(BigInt(750));
  });
});
