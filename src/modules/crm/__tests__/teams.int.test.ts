import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { listTeams, saveTeam } from '../service';

loadDevEnv();

const userId = randomUUID();
const companyId = randomUUID();
const otherCompanyId = randomUUID();
const PERMS = new Set(['crm.lead.read', 'crm.lead.write']);
const args = (cid: string): TenantArgs => ({ userId, companyId: cid, perms: PERMS, locale: 'en' });

beforeAll(async () => {
  const db = getDb();
  await db.insert(users).values({ id: userId, name: 'Teams Test', email: `teams-${userId}@test.invalid` });
  await db.insert(companies).values([
    { id: companyId, legalName: 'Teams Test A', displayName: 'Teams A' },
    { id: otherCompanyId, legalName: 'Teams Test B', displayName: 'Teams B' },
  ]);
});

describe('sales teams tenant isolation', () => {
  it('a team saved in one company is not listed in another company', async () => {
    const created = await withTenant(args(companyId), (ctx) => saveTeam(ctx, { name: 'Oran team' }));
    expect(created.ok).toBe(true);

    const mine = await withTenant(args(companyId), (ctx) => listTeams(ctx));
    expect(mine.ok && mine.value.some((t) => t.name === 'Oran team')).toBe(true);

    const theirs = await withTenant(args(otherCompanyId), (ctx) => listTeams(ctx));
    expect(theirs.ok && theirs.value.some((t) => t.name === 'Oran team')).toBe(false);
  });
});
