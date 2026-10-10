import { and, eq, sql } from 'drizzle-orm';
import type { Ctx, Locale } from '@/core/ctx';
import { withTenant } from '@/core/db/tenant';
import type { Db } from '@/core/db/types';
import { companies, memberships, roles } from '@/core/db/schema/tenancy';
import { loadTenantArgs } from '@/core/tenancy/service';
import { actionConfigSchemas, type ActionName } from './config';
import { conditionsSchema, matchesConditions } from './conditions';
import { RECORD_ENTITIES, timeConfigSchema, type TimeConfig } from './fields';
import { executeAction, runInSavepoint } from './engine';
import { automationRuleRuns, automationRules, type AutomationRule } from './schema';

// Records checked per rule per run. Records that do not match the conditions are re-checked the next day.
export const DUE_LIMIT = 200;

export interface TimedRulesResult {
  fired: number;
  failed: number;
}

/** Fires every active time rule of one company once per record. Runs inside ctx.tx (one tenant). */
export async function runTimedRules(ctx: Ctx): Promise<TimedRulesResult> {
  const result: TimedRulesResult = { fired: 0, failed: 0 };
  const rules = await ctx.tx
    .select()
    .from(automationRules)
    .where(and(eq(automationRules.companyId, ctx.companyId), eq(automationRules.active, true), eq(automationRules.kind, 'time')));

  for (const rule of rules) {
    try {
      const counts = await runTimeRule(ctx, rule);
      result.fired += counts.fired;
      result.failed += counts.failed;
    } catch {
      // A broken rule (for example a column not yet migrated) must not stop the other rules.
      result.failed += 1;
    }
  }
  return result;
}

async function runTimeRule(ctx: Ctx, rule: AutomationRule): Promise<TimedRulesResult> {
  const result: TimedRulesResult = { fired: 0, failed: 0 };
  const timeConfig = timeConfigSchema.safeParse(rule.timeConfig);
  const conditions = conditionsSchema.safeParse(rule.conditions);
  if (!timeConfig.success || !conditions.success || !(rule.action in actionConfigSchemas)) {
    result.failed += 1;
    return result;
  }
  const action = rule.action as ActionName;
  const rows = await dueRecords(ctx, rule.id, timeConfig.data);

  for (const row of rows) {
    const recordId = String(row.id);
    const payload = { ...row, id: recordId };
    if (!matchesConditions(payload, conditions.data)) continue;
    // Mark the record first, so a failing action is not retried every day.
    await ctx.tx.insert(automationRuleRuns).values({ companyId: ctx.companyId, ruleId: rule.id, recordId }).onConflictDoNothing();
    const ok = await runInSavepoint(ctx, (sub) =>
      executeAction(sub, { name: `time.${timeConfig.data.entity}`, payload }, action, rule.actionConfig),
    );
    if (ok) result.fired += 1;
    else result.failed += 1;
  }
  return result;
}

/** Records of the rule's table whose date field plus delay is today or earlier, and that the rule has not fired on. */
async function dueRecords(ctx: Ctx, ruleId: string, cfg: TimeConfig): Promise<Record<string, unknown>[]> {
  const spec = RECORD_ENTITIES[cfg.entity];
  const res = await ctx.tx.execute(sql`
    select t.* from ${sql.identifier(spec.table)} as t
    where t.company_id = ${ctx.companyId}::uuid
      and (${sql.identifier('t')}.${sql.identifier(cfg.dateField)})::date + ${cfg.delayDays}::int <= current_date
      and not exists (
        select 1 from automation_rule_runs r
        where r.company_id = t.company_id and r.rule_id = ${ruleId}::uuid and r.record_id = t.id
      )
    order by t.id
    limit ${DUE_LIMIT}`);
  return res.rows as Record<string, unknown>[];
}

export interface TimedRunsSummary {
  companies: number;
  fired: number;
  failed: number;
  failedCompanies: number;
}

// Runs as the owner connection to find companies with active time rules, then one withTenant
// transaction per company, acting as the company owner (same pattern as the credit reminders).
export async function runTimedRulesForCompanies(db: Db): Promise<TimedRunsSummary> {
  const summary: TimedRunsSummary = { companies: 0, fired: 0, failed: 0, failedCompanies: 0 };
  const rows = await db
    .selectDistinct({ companyId: companies.id, defaultLocale: companies.defaultLocale })
    .from(automationRules)
    .innerJoin(companies, eq(companies.id, automationRules.companyId))
    .where(and(eq(automationRules.active, true), eq(automationRules.kind, 'time')));

  for (const row of rows) {
    try {
      const owner = await findOwnerUserId(db, row.companyId);
      if (!owner) {
        summary.failedCompanies += 1;
        continue;
      }
      const args = await loadTenantArgs(owner, row.companyId, (row.defaultLocale as Locale) ?? 'fr', db);
      if (!args.ok) {
        summary.failedCompanies += 1;
        continue;
      }
      const counts = await withTenant(args.value, (ctx) => runTimedRules(ctx), db);
      summary.companies += 1;
      summary.fired += counts.fired;
      summary.failed += counts.failed;
    } catch {
      summary.failedCompanies += 1;
    }
  }
  return summary;
}

async function findOwnerUserId(db: Db, companyId: string): Promise<string | undefined> {
  const [row] = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .innerJoin(roles, and(eq(roles.id, memberships.roleId), eq(roles.key, 'owner')))
    .where(and(eq(memberships.companyId, companyId), eq(memberships.status, 'active')))
    .limit(1);
  return row?.userId;
}
