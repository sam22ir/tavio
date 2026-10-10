import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { getDb } from '@/core/db/client';
import { users } from '@/core/db/schema';
import { withTenant } from '@/core/db/tenant';
import { deleteTestCompanies } from '@/testing/db-cleanup';
import { archiveDemoCompany, companyIsDemo, createCompany, homeCompanyOf, listMyCompanies, loadTenantArgs } from '@/core/tenancy/service';
import { createSampleCompany } from '../demo-company';
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
});

describe.skipIf(!process.env.TAVIO_W5_DB)('demo company with sample data (database)', () => {
  it('creates a demo company next to the real one, seeds it, then archives it', async () => {
    await db.insert(users).values({ id: userId, name: 'Demo Owner', email: `demo-${userId}@test.invalid` });
    const real = await createCompany(userId, { legalName: 'Real Check SARL' }, db);
    if (!real.ok) throw new Error(real.error.message);
    const realId = real.value.companyId;
    createdCompanies.push(realId);

    const demo = await createSampleCompany({ userId, sourceCompanyId: realId, legalName: 'Demo Check', locale: 'fr' }, db);
    if (!demo.ok) throw new Error(demo.error.message);
    const demoId = demo.value.companyId;
    createdCompanies.push(demoId);
    expect(await companyIsDemo(demoId, db)).toBe(true);
    expect(await companyIsDemo(realId, db)).toBe(false);

    const moves = await db.select({ id: stockMoves.id }).from(stockMoves).where(eq(stockMoves.companyId, demoId));
    const dels = await db.select({ id: deliveries.id }).from(deliveries).where(eq(deliveries.companyId, demoId));
    expect(moves.length).toBeGreaterThanOrEqual(25);
    expect(dels.length).toBeGreaterThan(0);

    const tenant = await loadTenantArgs(userId, demoId, 'fr', db);
    if (!tenant.ok) throw new Error(tenant.error.message);
    await withTenant(
      tenant.value,
      async (ctx) => {
        const tb = await trialBalance(ctx, {});
        expect(tb.balanced).toBe(true);
        expect(tb.rows.find((r) => r.code === '600')?.debitCents).toBeGreaterThan(BigInt(0));
        expect((await bilanAt(ctx, new Date().toISOString().slice(0, 10))).balanced).toBe(true);
      },
      db,
    );

    expect((await homeCompanyOf(userId, db))?.id).toBe(realId);
    expect((await listMyCompanies(userId, db)).map((c) => c.id)).toContain(demoId);

    const archived = await archiveDemoCompany(userId, demoId, db);
    expect(archived.ok).toBe(true);
    expect((await listMyCompanies(userId, db)).map((c) => c.id)).not.toContain(demoId);
    expect((await archiveDemoCompany(userId, realId, db)).ok).toBe(false);
  }, 900_000);
}, 60_000);
