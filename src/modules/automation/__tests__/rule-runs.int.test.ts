import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { automationRuleRuns, automationRules } from '../schema';

loadDevEnv();

// Two tenants: company A's context must not read, change or insert company B's rule runs.
const db = getDb();
const userId = randomUUID();
const companyA = randomUUID();
const companyB = randomUUID();
const ruleB = randomUUID();
const runB = randomUUID();
const recordId = randomUUID();
const PERMS = new Set<string>();
const argsFor = (companyId: string): TenantArgs => ({ userId, companyId, perms: PERMS, locale: 'en' });

beforeAll(async () => {
  await db.insert(users).values({ id: userId, name: 'automation test', email: `automation-${userId}@test.invalid` });
  await db.insert(companies).values([
    { id: companyA, legalName: 'Automation A', displayName: 'Automation A' },
    { id: companyB, legalName: 'Automation B', displayName: 'Automation B' },
  ]);
  await db.insert(automationRules).values({
    id: ruleB, companyId: companyB, name: 'Time rule B', kind: 'time', action: 'cancel_activity_plans',
    timeConfig: { entity: 'lead', dateField: 'created_at', delayDays: 1 }, actionConfig: { entity: 'crm.lead', recordIdField: 'id' },
  });
  await db.insert(automationRuleRuns).values({ id: runB, companyId: companyB, ruleId: ruleB, recordId });
});

afterAll(async () => {
  await db.delete(automationRuleRuns).where(eq(automationRuleRuns.companyId, companyB));
  await db.delete(automationRules).where(eq(automationRules.companyId, companyB));
  await db.delete(companies).where(eq(companies.id, companyA));
  await db.delete(companies).where(eq(companies.id, companyB));
  await db.delete(users).where(eq(users.id, userId));
});

describe('automation_rule_runs tenant isolation', () => {
  it('company A cannot read company B rule runs', async () => {
    const rows = await withTenant(argsFor(companyA), (ctx) => ctx.tx.select().from(automationRuleRuns), db);
    expect(rows.map((r) => r.id)).not.toContain(runB);
  });

  it('company A cannot update or delete company B rule runs', async () => {
    const touched = await withTenant(argsFor(companyA), async (ctx) => {
      const updated = await ctx.tx.update(automationRuleRuns).set({ recordId: randomUUID() }).where(eq(automationRuleRuns.id, runB)).returning({ id: automationRuleRuns.id });
      const deleted = await ctx.tx.delete(automationRuleRuns).where(eq(automationRuleRuns.id, runB)).returning({ id: automationRuleRuns.id });
      return updated.length + deleted.length;
    }, db);
    expect(touched).toBe(0);
  });

  it('company A cannot insert a run for company B', async () => {
    await expect(
      withTenant(argsFor(companyA), (ctx) =>
        ctx.tx.insert(automationRuleRuns).values({ companyId: companyB, ruleId: ruleB, recordId: randomUUID() }),
      db),
    ).rejects.toThrow();
  });
});
