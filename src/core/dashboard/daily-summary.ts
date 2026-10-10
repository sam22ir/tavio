import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Ctx, Locale } from '@/core/ctx';
import { withTenant } from '@/core/db/tenant';
import type { Db } from '@/core/db/types';
import { companies, companyModules, memberships, roles } from '@/core/db/schema/tenancy';
import { loadTenantArgs } from '@/core/tenancy/service';
import { scheduleActivity, todayIso } from '@/modules/chatter/service';
import { activities } from '@/modules/chatter/schema';
import { leads, salesTeams } from '@/modules/crm/schema';
import { leadScope } from '@/modules/crm/service';

export interface DailySummaryResult {
  /** Companies summarized in this run. */
  companies: number;
  activitiesCreated: number;
  /** Companies that failed, including crm companies with no active owner. */
  failedCompanies: number;
  /** Companies not reached in this run because the time budget ran out. The next run picks them up. */
  deferredCompanies: number;
}

/** A lead is stuck when it has been in its current stage longer than this many days. */
export const STUCK_AFTER_DAYS = 14;
/** Stop starting new companies after this many milliseconds, so the cron stays inside its time limit. */
export const TIME_BUDGET_MS = 15_000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const SUMMARY_ENTITY = 'crm.daily_summary';

interface OwnerRow {
  companyId: string;
  defaultLocale: string;
  userId: string | null;
  roleKey: string | null;
}

/**
 * Daily cron: one summary activity per user per day, done or not. The owner of each active lead
 * without an open activity gets a count; the team leader (or the owner when there is no team) gets
 * the count of leads stuck longer than STUCK_AFTER_DAYS in a stage.
 *
 * Identity: each crm company is summarized as its oldest active owner (memberships.created_at, then
 * user_id). Companies with no active owner count as failed.
 * Bounds: counts are aggregated in SQL; companies are processed in a rotated order (the start moves
 * each day) and the run stops starting new companies after TIME_BUDGET_MS.
 */
export async function runDailySummaries(db: Db, now: Date = new Date()): Promise<DailySummaryResult> {
  const started = Date.now();
  const result: DailySummaryResult = { companies: 0, activitiesCreated: 0, failedCompanies: 0, deferredCompanies: 0 };

  const rows: OwnerRow[] = await db
    .select({
      companyId: companies.id,
      defaultLocale: companies.defaultLocale,
      userId: memberships.userId,
      roleKey: roles.key,
    })
    .from(companies)
    .innerJoin(
      companyModules,
      and(
        eq(companyModules.companyId, companies.id),
        eq(companyModules.moduleId, 'crm'),
        eq(companyModules.enabled, true),
      ),
    )
    .leftJoin(
      memberships,
      and(eq(memberships.companyId, companies.id), eq(memberships.status, 'active')),
    )
    .leftJoin(roles, and(eq(roles.id, memberships.roleId), eq(roles.key, 'owner')))
    .orderBy(asc(companies.id), asc(memberships.createdAt), asc(memberships.userId));

  // First owner per company (rows are ordered oldest membership first).
  const ownerByCompany = new Map<string, { userId: string; defaultLocale: string }>();
  const crmCompanies = new Set<string>();
  for (const row of rows) {
    crmCompanies.add(row.companyId);
    if (row.roleKey === 'owner' && row.userId && !ownerByCompany.has(row.companyId)) {
      ownerByCompany.set(row.companyId, { userId: row.userId, defaultLocale: row.defaultLocale });
    }
  }
  result.failedCompanies += [...crmCompanies].filter((id) => !ownerByCompany.has(id)).length;

  // Rotate the order by day so a company at the end of the list is not always the one deferred.
  const ordered = [...ownerByCompany.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const offset = ordered.length > 0 ? Math.floor(now.getTime() / DAY_MS) % ordered.length : 0;
  const queue = [...ordered.slice(offset), ...ordered.slice(0, offset)];

  for (let i = 0; i < queue.length; i += 1) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      result.deferredCompanies = queue.length - i;
      break;
    }
    const [companyId, owner] = queue[i]!;
    const locale = (owner.defaultLocale as Locale) ?? 'fr';
    try {
      const args = await loadTenantArgs(owner.userId, companyId, locale, db);
      if (!args.ok) {
        result.failedCompanies += 1;
        continue;
      }
      const created = await withTenant(args.value, (ctx) => summarizeCompany(ctx, now), db);
      result.companies += 1;
      result.activitiesCreated += created;
    } catch {
      result.failedCompanies += 1;
    }
  }

  return result;
}

async function summarizeCompany(ctx: Ctx, now: Date): Promise<number> {
  const scope = await leadScope(ctx);
  const ownerExpr = sql`coalesce(${leads.salespersonId}, ${leads.createdBy})`;
  const leaderExpr = sql`coalesce(${salesTeams.leaderId}, ${leads.salespersonId}, ${leads.createdBy})`;
  const openActivityExists = sql`exists (select 1 from ${activities} where ${activities.companyId} = ${leads.companyId} and ${activities.entity} = 'crm.lead' and ${activities.recordId} = ${leads.id} and ${activities.doneAt} is null)`;
  const openLeadFilter = and(
    eq(leads.companyId, ctx.companyId),
    eq(leads.active, true),
    eq(leads.status, 'open'),
    scope,
  );

  const noActivityRows = await ctx.tx
    .select({ userId: ownerExpr, n: sql<string>`count(*)` })
    .from(leads)
    .where(and(openLeadFilter, sql`not ${openActivityExists}`, sql`${ownerExpr} is not null`))
    .groupBy(ownerExpr);

  const stuckRows = await ctx.tx
    .select({ userId: leaderExpr, n: sql<string>`count(*)` })
    .from(leads)
    .leftJoin(salesTeams, eq(salesTeams.id, leads.teamId))
    .where(
      and(
        openLeadFilter,
        sql`${leads.stageEnteredAt} < now() - make_interval(days => ${STUCK_AFTER_DAYS})`,
        sql`${leaderExpr} is not null`,
      ),
    )
    .groupBy(leaderExpr);

  const totals = new Map<string, { noActivity: number; stuck: number }>();
  const entry = (userId: string) => {
    let t = totals.get(userId);
    if (!t) {
      t = { noActivity: 0, stuck: 0 };
      totals.set(userId, t);
    }
    return t;
  };
  for (const r of noActivityRows) if (r.userId) entry(String(r.userId)).noActivity = Number(r.n);
  for (const r of stuckRows) if (r.userId) entry(String(r.userId)).stuck = Number(r.n);

  const userIds = [...totals.entries()].filter(([, t]) => t.noActivity + t.stuck > 0).map(([id]) => id);
  if (userIds.length === 0) return 0;

  // Dedupe: any summary for the user today, done or not, means it was already created.
  const today = todayIso(now);
  const existing = await ctx.tx
    .select({ recordId: activities.recordId })
    .from(activities)
    .where(
      and(
        eq(activities.companyId, ctx.companyId),
        eq(activities.entity, SUMMARY_ENTITY),
        eq(activities.dueDate, today),
        inArray(activities.recordId, userIds),
      ),
    );
  const alreadySummarized = new Set(existing.map((r) => r.recordId));

  let created = 0;
  for (const userId of userIds) {
    if (alreadySummarized.has(userId)) continue;
    const t = totals.get(userId)!;
    const summary = `Daily follow-up: ${t.noActivity} lead(s) without an open activity, ${t.stuck} stuck over ${STUCK_AFTER_DAYS} days`;
    const res = await scheduleActivity(ctx, {
      entity: SUMMARY_ENTITY,
      recordId: userId,
      typeKey: 'todo',
      summary,
      dueDate: today,
      assigneeId: userId,
    });
    if (res.ok) created += 1;
  }
  return created;
}
