import { DEFAULT_MODULES } from './default-roles';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { getDb } from '@/core/db/client';
import {
  companies,
  companyModules,
  memberships,
  rolePermissions,
  roles,
  users,
} from '@/core/db/schema';
import { activityTypes } from '@/modules/chatter/schema';
import { createCompany, enabledModules, listMyCompanies, loadTenantArgs } from './service';

loadDevEnv();

const db = getDb();
const userId = randomUUID();
const createdCompanyIds: string[] = [];

async function makeUser(): Promise<void> {
  await db.insert(users).values({
    id: userId,
    name: 'Tenancy Test',
    email: `tenancy-${userId}@example.test`,
  });
}

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

describe('tenancy service', () => {
  it('rejects a legal name shorter than 2 characters', async () => {
    const result = await createCompany(userId, { legalName: 'A' }, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION');
  });

  it('creates a company with seeded roles, owner membership and modules', async () => {
    await makeUser();
    const result = await createCompany(userId, { legalName: 'Tenancy SARL' }, db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const companyId = result.value.companyId;
    createdCompanyIds.push(companyId);

    const seededRoles = await db.select({ key: roles.key }).from(roles).where(eq(roles.companyId, companyId));
    expect(seededRoles.map((r) => r.key).sort()).toEqual(['admin', 'manager', 'owner', 'staff']);

    const modules = await enabledModules(companyId, db);
    expect(modules.sort()).toEqual([...DEFAULT_MODULES].sort());
  });

  it('lists the company for its owner with the owner role', async () => {
    const companies = await listMyCompanies(userId, db);
    const mine = companies.filter((c) => createdCompanyIds.includes(c.id));
    expect(mine).toHaveLength(1);
    expect(mine[0]?.roleKey).toBe('owner');
    expect(mine[0]?.name).toBe('Tenancy SARL');
  });

  it('loads tenant args with the owner permission set', async () => {
    const result = await loadTenantArgs(userId, createdCompanyIds[0] as string, 'en', db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.userId).toBe(userId);
      expect(result.value.perms.has('*')).toBe(true);
    }
  });

  it('returns FORBIDDEN for a company the user does not belong to', async () => {
    const result = await loadTenantArgs(userId, randomUUID(), 'en', db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });
});
