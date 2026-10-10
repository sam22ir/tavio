import { and, eq, sql } from 'drizzle-orm';
import type { Ctx, Locale } from '@/core/ctx';
import { withTenant } from '@/core/db/tenant';
import type { Db } from '@/core/db/types';
import { companies, memberships, roles } from '@/core/db/schema/tenancy';
import { loadTenantArgs } from '@/core/tenancy/service';
import { actionConfigSchemas, type ActionName } from './config';
import { conditionsSchema, matchesConditions, type Condition } from './conditions';
import { readableColumns, RECORD_ENTITIES, timeConfigSchema, type TimeConfig, type TimeEntity } from './fields';
import { executeAction, runInRuleChain, runInSavepoint } from './engine';
import { automationRuleRuns, automationRules, type AutomationRule } from './schema';

// Records fetched per page while scanning a rule.
export const DUE_LIMIT = 200;
// Records evaluated per company per cron run, across all of its time rules.
export const COMPANY_RECORD_BUDGET = 500;
// Wall-clock budget for one cron run across all companies. Unfinished work resumes on the next tick.
export const CRON_TIME_BUDGET_MS = 20_000;

export interface RunBudget {
  remaining: number;
  deadline: number;
}

export interface TimedRulesResult {
  fired: number;
  skipped: number;
  failed: number;
  /** True when the budget ran out before every due record was evaluated. */
  deferred: boolean;
}

function emptyResult(): TimedRulesResult {
  return { fired: 0, skipped: 0, failed: 0, deferred: false };
}

function outOfBudget(budget: RunBudget): boolean {
  return budget.remaining <= 0 || Date.now() >= budget.deadline;
}

/** Fires every active time rule of one company once per record. Runs inside ctx.tx (one tenant). */
export async function runTimedRules(ctx: Ctx, budget: RunBudget): Promise<TimedRulesResult> {
  const result = emptyResult();
  const rules = await ctx.tx
    .select()
    .from(automationRules)
    .where(and(eq(automationRules.companyId, ctx.companyId), eq(automationRules.active, true), eq(automationRules.kind, 'time')));

  for (const rule of rules) {
    if (outOfBudget(budget)) {
      result.deferred = true;
      break;
    }
    try {
      const counts = await runTimeRule(ctx, rule, budget);
      result.fired += counts.fired;
      result.skipped += counts.skipped;
      result.failed += counts.failed;
      if (counts.deferred) {
        result.deferred = true;
        break;
      }
    } catch {
      // A broken rule (for example a column not yet migrated) must not stop the other rules.
      result.failed += 1;
    }
  }
  return result;
}

/** Columns the rule needs: the id, the date field, and every field its conditions or templates read. */
function neededColumns(rule: AutomationRule, cfg: TimeConfig, conditions: Condition[]): string[] | null {
  const readable = new Set(readableColumns(cfg.entity));
  const referenced = [
    cfg.dateField,
    ...conditions.map((c) => c.field.split('.')[0] ?? ''),
    ...[...JSON.stringify(rule.actionConfig).matchAll(/\{([A-Za-z0-9_]+)[.}]/g)].map((m) => m[1] ?? ''),
  ];
  const needed = [...new Set(['id', ...referenced])];
  return needed.every((c) => readable.has(c)) ? needed : null;
}

async function runTimeRule(ctx: Ctx, rule: AutomationRule, budget: RunBudget): Promise<TimedRulesResult> {
  const result = emptyResult();
  const timeConfig = timeConfigSchema.safeParse(rule.timeConfig);
  const conditions = conditionsSchema.safeParse(rule.conditions);
  if (!timeConfig.success || !conditions.success || !(rule.action in actionConfigSchemas)) {
    result.failed += 1;
    return result;
  }
  const columns = neededColumns(rule, timeConfig.data, conditions.data);
  if (!columns) {
    result.failed += 1;
    return result;
  }
  const action = rule.action as ActionName;
  let after: DueCursor | null = null;

  // Keyset pagination over oldest-due-first records. Records already fired on or skipped are excluded in SQL,
  // so every page holds only records still to evaluate.
  for (;;) {
    if (outOfBudget(budget)) {
      result.deferred = true;
      return result;
    }
    const pageLimit = Math.min(DUE_LIMIT, budget.remaining);
    const rows: DueRow[] = await dueRecords(ctx, rule.id, timeConfig.data, columns, after, pageLimit);
    for (const row of rows) {
      if (outOfBudget(budget)) {
        result.deferred = true;
        return result;
      }
      budget.remaining -= 1;
      const { due_on: dueOn, ...record } = row;
      after = { dueOn, id: String(record.id) };
      const recordId = String(record.id);
      const payload = { ...record, id: recordId };
      if (!matchesConditions(payload, conditions.data)) {
        // Mark the non-matching record as skipped so it is not fetched again.
        await ctx.tx
          .insert(automationRuleRuns)
          .values({ companyId: ctx.companyId, ruleId: rule.id, recordId, status: 'skipped' })
          .onConflictDoNothing();
        result.skipped += 1;
        continue;
      }
      // The run row is written inside the same savepoint as the action: a failing action rolls back
      // the mark, so the record is retried on the next run.
      const ok = await runInRuleChain(rule.id, () =>
        runInSavepoint(ctx, async (sub) => {
          const done = await executeAction(sub, { name: `time.${timeConfig.data.entity}`, payload }, action, rule.actionConfig);
          if (!done) throw new Error('automation action did not take effect');
          await sub.tx
            .insert(automationRuleRuns)
            .values({ companyId: ctx.companyId, ruleId: rule.id, recordId, status: 'done' })
            .onConflictDoNothing();
          return true;
        }),
      );
      if (ok) result.fired += 1;
      else result.failed += 1;
    }
    if (rows.length < pageLimit) return result;
  }
}

interface DueCursor {
  dueOn: string;
  id: string;
}

type DueRow = Record<string, unknown> & { due_on: string };

/**
 * Records of the rule's table whose date field plus delay is today or earlier, with no run row yet for this rule
 * (done or skipped), ordered oldest due first. Selects only the given columns.
 */
async function dueRecords(
  ctx: Ctx,
  ruleId: string,
  cfg: TimeConfig,
  columns: string[],
  after: DueCursor | null,
  limit: number,
): Promise<DueRow[]> {
  const spec = RECORD_ENTITIES[cfg.entity as TimeEntity];
  const dueOn = sql`((t.${sql.identifier(cfg.dateField)})::date + ${cfg.delayDays}::int)`;
  const cursor = after
    ? sql`and (${dueOn} > ${after.dueOn}::date or (${dueOn} = ${after.dueOn}::date and t.id > ${after.id}::uuid))`
    : sql``;
  const selected = sql.join(
    columns.map((c) => sql`t.${sql.identifier(c)}`),
    sql`, `,
  );
  const res = await ctx.tx.execute(sql`
    select ${selected}, (${dueOn})::text as due_on from ${sql.identifier(spec.table)} as t
    where t.company_id = ${ctx.companyId}::uuid
      and ${dueOn} <= current_date
      and not exists (
        select 1 from automation_rule_runs r
        where r.company_id = t.company_id and r.rule_id = ${ruleId}::uuid and r.record_id = t.id
      )
      ${cursor}
    order by due_on asc, t.id asc
    limit ${limit}`);
  return res.rows as DueRow[];
}

export interface TimedRunsSummary {
  companies: number;
  fired: number;
  skipped: number;
  failed: number;
  failedCompanies: number;
  /** Companies not reached, or left unfinished, because the cron time budget ran out. */
  deferredCompanies: number;
}

// Runs as the owner connection to find companies with active time rules, then one withTenant
// transaction per company, acting as the company owner (same pattern as the credit reminders).
export async function runTimedRulesForCompanies(db: Db, timeBudgetMs = CRON_TIME_BUDGET_MS): Promise<TimedRunsSummary> {
  const deadline = Date.now() + timeBudgetMs;
  const summary: TimedRunsSummary = { companies: 0, fired: 0, skipped: 0, failed: 0, failedCompanies: 0, deferredCompanies: 0 };
  const rows = await db
    .selectDistinct({ companyId: companies.id, defaultLocale: companies.defaultLocale })
    .from(automationRules)
    .innerJoin(companies, eq(companies.id, automationRules.companyId))
    .where(and(eq(automationRules.active, true), eq(automationRules.kind, 'time')));

  for (const row of rows) {
    if (Date.now() >= deadline) {
      summary.deferredCompanies += 1;
      continue;
    }
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
      const budget: RunBudget = { remaining: COMPANY_RECORD_BUDGET, deadline };
      const counts = await withTenant(args.value, (ctx) => runTimedRules(ctx, budget), db);
      summary.companies += 1;
      summary.fired += counts.fired;
      summary.skipped += counts.skipped;
      summary.failed += counts.failed;
      if (counts.deferred) summary.deferredCompanies += 1;
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
