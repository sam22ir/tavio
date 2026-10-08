import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { getDb } from '@/core/db/client';
import { withTenant } from '@/core/db/tenant';
import { companies, companyModules, memberships, rolePermissions, roles, users } from '@/core/db/schema';
import { createCompany, loadTenantArgs } from '@/core/tenancy/service';
import { activityTypes } from '@/modules/chatter/schema';
import { dashboardKpis } from './kpis';

loadDevEnv();

const db = getDb();
const userId = randomUUID();
const createdCompanyIds: string[] = [];

afterAll(async () => {
  if (createdCompanyIds.length > 0) {
    await db.delete(activityTypes).where(inArray(activityTypes.companyId, createdCompanyIds));
    await db.delete(rolePermissions).where(inArray(rolePermissions.companyId, createdCompanyIds));
    await db.delete(memberships).where(inArray(memberships.companyId, createdCompanyIds));
    await db.delete(companyModules).where(inArray(companyModules.companyId, createdCompanyIds));
    await db.delete(roles).where(inArray(roles.companyId, createdCompanyIds));
    await db.delete(companies).where(inArray(companies.id, createdCompanyIds));
  }
  await db.delete(users).where(eq(users.id, userId));
});

describe('dashboardKpis', () => {
  it('returns zeros for an empty company', async () => {
    await db.insert(users).values({ id: userId, name: 'Dashboard Test', email: `dash-${userId}@example.test` });
    const created = await createCompany(userId, { legalName: 'Dashboard Empty Shop' }, db);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    createdCompanyIds.push(created.value.companyId);

    const args = await loadTenantArgs(userId, created.value.companyId, 'fr', db);
    expect(args.ok).toBe(true);
    if (!args.ok) return;

    const kpis = await withTenant(args.value, (ctx) => dashboardKpis(ctx), db);
    expect(kpis).toEqual({
      dueTodayCents: 0n,
      overdueCents: 0n,
      overdueCount: 0,
      collectedThisMonthCents: 0n,
      activeContracts: 0,
      openLeads: 0,
    });
  });
});
