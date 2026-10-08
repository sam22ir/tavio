import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '@/core/db/client';
import { sequences } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { nextNumber } from './index';

loadDevEnv();

const db = getDb();
const companies: string[] = [];

function args(): TenantArgs {
  const companyId = randomUUID();
  companies.push(companyId);
  return { userId: randomUUID(), companyId, perms: new Set<string>(), locale: 'en' };
}

afterAll(async () => {
  for (const companyId of companies) {
    await db.delete(sequences).where(eq(sequences.companyId, companyId));
  }
});

describe('nextNumber', () => {
  it('hands out sequential numbers with default padding', async () => {
    const a = args();
    const first = await withTenant(a, (ctx) => nextNumber(ctx, 'INV'), db);
    const second = await withTenant(a, (ctx) => nextNumber(ctx, 'INV'), db);
    expect(first).toBe('00001');
    expect(second).toBe('00002');
  });

  it('keeps separate counters per code', async () => {
    const a = args();
    const inv = await withTenant(a, (ctx) => nextNumber(ctx, 'INV', { prefix: 'FAC-', padding: 3 }), db);
    const quote = await withTenant(a, (ctx) => nextNumber(ctx, 'QUO'), db);
    expect(inv).toBe('FAC-001');
    expect(quote).toBe('00001');
  });

  it('does not consume a number when the transaction rolls back', async () => {
    const a = args();
    await withTenant(a, (ctx) => nextNumber(ctx, 'INV'), db);
    await expect(
      withTenant(a, async (ctx) => {
        await nextNumber(ctx, 'INV');
        throw new Error('boom');
      }, db),
    ).rejects.toThrow('boom');
    const next = await withTenant(a, (ctx) => nextNumber(ctx, 'INV'), db);
    expect(next).toBe('00002');
  });

  it('replaces the {YYYY} token with the current year', async () => {
    const a = args();
    const year = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Algiers', year: 'numeric' }).format(new Date());
    const n = await withTenant(a, (ctx) => nextNumber(ctx, 'FAC', { prefix: 'FAC-{YYYY}-' }), db);
    expect(n).toBe(`FAC-${year}-00001`);
  });
});
