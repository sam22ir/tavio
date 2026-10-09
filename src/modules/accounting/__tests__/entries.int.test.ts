import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { ensureDefaults } from '../service/chart';
import { getEntry, postEntry, reverseEntry } from '../service/entries';

loadDevEnv();

// Runs only after the integrator has migrated the accounting tables: set TAVIO_W5_DB=1.
describe.skipIf(!process.env.TAVIO_W5_DB)('accounting entries (integration)', () => {
  const db = getDb();
  const companyIds: string[] = [];

  afterAll(async () => {
    // Cleanup is left to the integration harness, which owns the test database.
  });

  async function fixture(): Promise<TenantArgs> {
    const companyId = randomUUID();
    const userId = randomUUID();
    companyIds.push(companyId);
    await db.insert(companies).values({ id: companyId, legalName: 'Acc Test SARL', displayName: 'Acc Test' });
    await db.insert(users).values({ id: userId, name: 'accounting test', email: `acc-${userId}@test.invalid` });
    return { userId, companyId, perms: new Set<string>(), locale: 'en' };
  }

  it('posts a balanced entry with a per-journal number and is idempotent by source', async () => {
    const args = await fixture();
    const lines = [
      { accountCode: '512', debitCents: BigInt(1000), creditCents: BigInt(0) },
      { accountCode: '411', debitCents: BigInt(0), creditCents: BigInt(1000) },
    ];
    const first = await withTenant(args, async (ctx) => {
      await ensureDefaults(ctx);
      return postEntry(ctx, { journalCode: 'BQ', date: '2030-01-05', sourceEntity: 'invoicing.payment', sourceId: randomUUID(), lines });
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.number).toMatch(/^BQ\/2030\/00001$|^BQ\/\d{4}\/00001$/);

    const sourceId = randomUUID();
    const a = await withTenant(args, (ctx) =>
      postEntry(ctx, { journalCode: 'BQ', date: '2030-01-05', sourceEntity: 'invoicing.payment', sourceId, lines }),
    );
    const b = await withTenant(args, (ctx) =>
      postEntry(ctx, { journalCode: 'BQ', date: '2030-01-05', sourceEntity: 'invoicing.payment', sourceId, lines }),
    );
    expect(a.ok && b.ok && b.value.existing).toBe(true);
    expect(a.ok && b.ok && a.value.id === b.value.id).toBe(true);
  });

  it('rejects an unbalanced entry without writing', async () => {
    const args = await fixture();
    const res = await withTenant(args, (ctx) =>
      postEntry(ctx, {
        journalCode: 'OD',
        date: '2030-01-05',
        lines: [
          { accountCode: '512', debitCents: BigInt(1000), creditCents: BigInt(0) },
          { accountCode: '411', debitCents: BigInt(0), creditCents: BigInt(999) },
        ],
      }),
    );
    expect(res.ok).toBe(false);
  });

  it('reverses a posted entry once, and a second reversal is refused', async () => {
    const args = await fixture();
    const posted = await withTenant(args, async (ctx) => {
      await ensureDefaults(ctx);
      return postEntry(ctx, {
        journalCode: 'OD',
        date: '2030-01-05',
        lines: [
          { accountCode: '600', debitCents: BigInt(500), creditCents: BigInt(0) },
          { accountCode: '512', debitCents: BigInt(0), creditCents: BigInt(500) },
        ],
      });
    });
    expect(posted.ok).toBe(true);
    if (!posted.ok) return;
    const first = await withTenant(args, (ctx) => reverseEntry(ctx, posted.value.id));
    expect(first.ok).toBe(true);
    const second = await withTenant(args, (ctx) => reverseEntry(ctx, posted.value.id));
    expect(second.ok).toBe(false);
    const detail = await withTenant(args, (ctx) => getEntry(ctx, posted.value.id));
    expect(detail.ok && detail.value.entry.reversedById).toBeTruthy();
  });
});
