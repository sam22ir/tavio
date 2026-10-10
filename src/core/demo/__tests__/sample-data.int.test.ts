import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { getDb } from '@/core/db/client';
import { users, sampleRecords } from '@/core/db/schema';
import { withTenant } from '@/core/db/tenant';
import { deleteTestCompanies } from '@/testing/db-cleanup';
import { createCompany, loadTenantArgs } from '@/core/tenancy/service';
import { clearSampleRecords, seedSampleData } from '../sample-data';
import { stockMoves, deliveries } from '@/modules/inventory/schema';
import { trialBalance } from '@/modules/accounting/service/reports';
import { bilanAt } from '@/modules/accounting/service/statements';

loadDevEnv();

const db = getDb();
const userId = randomUUID();
const createdCompanies: string[] = [];

afterAll(async () => {
  await deleteTestCompanies(db, createdCompanies);
  await db.delete(users).where(eq(users.id, userId));
}, 60_000);

describe('sample data delivers sold goods (database)', () => {
  it('seeds outgoing moves and COGS, balances, and clears every sample row', async () => {
    await db.insert(users).values({ id: userId, name: 'Sample Data', email: `sample-${userId}@test.invalid` });
    const created = await createCompany(userId, { legalName: 'Sample Check SARL' }, db);
    if (!created.ok) throw new Error(created.error.message);
    const companyId = created.value.companyId;
    createdCompanies.push(companyId);
    const tenant = await loadTenantArgs(userId, companyId, 'fr', db);
    if (!tenant.ok) throw new Error(tenant.error.message);

    const { recorded } = await seedSampleData(tenant.value, db);
    expect(recorded).toBeGreaterThan(0);

    const moves = await db.select({ id: stockMoves.id }).from(stockMoves).where(eq(stockMoves.companyId, companyId));
    const dels = await db.select({ id: deliveries.id }).from(deliveries).where(eq(deliveries.companyId, companyId));
    expect(moves.length).toBeGreaterThanOrEqual(25);
    expect(dels.length).toBeGreaterThan(0);

    await withTenant(
      tenant.value,
      async (ctx) => {
        const tb = await trialBalance(ctx, {});
        expect(tb.balanced).toBe(true);
        const cogs = tb.rows.find((r) => r.code === '600');
        expect(cogs && cogs.debitCents > BigInt(0)).toBe(true);
        const bilan = await bilanAt(ctx, new Date().toISOString().slice(0, 10));
        expect(bilan.balanced).toBe(true);
      },
      db,
    );

    const removed = await clearSampleRecords(tenant.value, db);
    expect(removed).toBe(recorded);
    const left = await db.select({ id: sampleRecords.recordId }).from(sampleRecords).where(eq(sampleRecords.companyId, companyId));
    expect(left).toHaveLength(0);
    const movesAfter = await db.select({ id: stockMoves.id }).from(stockMoves).where(eq(stockMoves.companyId, companyId));
    const delsAfter = await db.select({ id: deliveries.id }).from(deliveries).where(eq(deliveries.companyId, companyId));
    expect(movesAfter).toHaveLength(0);
    expect(delsAfter).toHaveLength(0);
  }, 900_000);
}, 60_000);
