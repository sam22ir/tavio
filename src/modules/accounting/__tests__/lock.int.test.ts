import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { ensureDefaults } from '../service/chart';
import { postEntry } from '../service/entries';
import { createFiscalYear, closeFiscalYear } from '../service/fiscal';
import { setLockDate } from '../service/period';

loadDevEnv();

// Runs only after the accounting tables are migrated: set TAVIO_W5_DB=1.
describe.skipIf(!process.env.TAVIO_W5_DB)('accounting period lock (integration)', () => {
  const db = getDb();

  async function fixture(): Promise<TenantArgs> {
    const companyId = randomUUID();
    const userId = randomUUID();
    await db.insert(companies).values({ id: companyId, legalName: 'Lock Test SARL', displayName: 'Lock Test' });
    await db.insert(users).values({ id: userId, name: 'lock test', email: `lock-${userId}@test.invalid` });
    return { userId, companyId, perms: new Set<string>(), locale: 'en' };
  }

  const lines = [
    { accountCode: '512', debitCents: BigInt(1000), creditCents: BigInt(0) },
    { accountCode: '411', debitCents: BigInt(0), creditCents: BigInt(1000) },
  ];

  it('refuses postings on or before the lock date, including automatic ones', async () => {
    const args = await fixture();
    await withTenant(args, async (ctx) => {
      await ensureDefaults(ctx);
      await setLockDate(ctx, '2030-03-31');
      const locked = await postEntry(ctx, { journalCode: 'BQ', date: '2030-03-31', sourceEntity: 'invoicing.payment', sourceId: randomUUID(), lines });
      expect(locked.ok).toBe(false);
      if (!locked.ok) expect(locked.error.message).toBe('PERIOD_LOCKED');
      const open = await postEntry(ctx, { journalCode: 'BQ', date: '2030-04-01', sourceEntity: 'invoicing.payment', sourceId: randomUUID(), lines });
      expect(open.ok).toBe(true);
    });
  });

  it('refuses postings inside a closed fiscal year and generates the closing entries', async () => {
    const args = await fixture();
    await withTenant(args, async (ctx) => {
      await ensureDefaults(ctx);
      const year = await createFiscalYear(ctx, { name: '2031', startDate: '2031-01-01', endDate: '2031-12-31' });
      expect(year.ok).toBe(true);
      if (!year.ok) return;
      const expense = [
        { accountCode: '600', debitCents: BigInt(400), creditCents: BigInt(0) },
        { accountCode: '512', debitCents: BigInt(0), creditCents: BigInt(400) },
      ];
      expect((await postEntry(ctx, { journalCode: 'OD', date: '2031-06-01', lines: expense })).ok).toBe(true);
      const closed = await closeFiscalYear(ctx, year.value.id);
      expect(closed.ok).toBe(true);
      const refused = await postEntry(ctx, { journalCode: 'OD', date: '2031-06-02', lines });
      expect(refused.ok).toBe(false);
    });
  });
});
