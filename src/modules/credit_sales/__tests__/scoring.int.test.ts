import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { latestScore, refreshScore } from '../service/scoring';

loadDevEnv();

const userId = randomUUID();
const companyId = randomUUID();
const args = (): TenantArgs => ({ userId, companyId, perms: new Set<string>(), locale: 'en' });

beforeAll(async () => {
  await getDb()
    .insert(users)
    .values({ id: userId, name: 'scoring test', email: `scoring-${userId}@test.invalid` })
    .onConflictDoNothing();
  await getDb()
    .insert(companies)
    .values({ id: companyId, legalName: `scoring ${companyId}`, displayName: `scoring ${companyId}` })
    .onConflictDoNothing();
});

describe('client scoring (integration)', () => {
  it('a partner with no history is new, stores no row, and has no latest score', async () => {
    const partnerId = randomUUID();
    const result = await withTenant(args(), (ctx) => refreshScore(ctx, partnerId));
    expect(result).toEqual({ ok: true, value: { grade: 'new', score: 70 } });

    const latest = await withTenant(args(), (ctx) => latestScore(ctx, partnerId));
    expect(latest).toBeNull();
  });

  it('a second company cannot see scores of the first', async () => {
    const other: TenantArgs = { userId, companyId: randomUUID(), perms: new Set(), locale: 'en' };
    const partnerId = randomUUID();
    const latest = await withTenant(other, (ctx) => latestScore(ctx, partnerId));
    expect(latest).toBeNull();
  });
});
