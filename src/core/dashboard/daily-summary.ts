import { and, eq, sql } from 'drizzle-orm';
import type { Ctx, Locale } from '@/core/ctx';
import { withTenant } from '@/core/db/tenant';
import type { Db } from '@/core/db/types';
import { companies, companyModules, memberships, roles } from '@/core/db/schema/tenancy';
import { loadTenantArgs } from '@/core/tenancy/service';
import { ensureActivity, todayIso } from '@/modules/chatter/service';
import { activities } from '@/modules/chatter/schema';
import { leads, salesTeams } from '@/modules/crm/schema';
import { leadScope } from '@/modules/crm/service';

export interface DailySummaryResult {
  companies: number;
  activitiesCreated: number;
  failedCompanies: number;
}

/** A lead is stuck when it has been in its current stage longer than this many days. */
export const STUCK_AFTER_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

interface UserTotals {
  noActivity: number;
  stuck: number;
}

/**
 * Daily cron: one summary activity per user per day. The owner of each active lead without an open
 * activity gets a count; the team leader (or the owner when there is no team) gets the count of leads
 * stuck longer than STUCK_AFTER_DAYS in a stage. ensureActivity is idempotent per user per day.
 * Runs as the company owner, so the lead scope is the owner's full view.
 */
export async function runDailySummaries(db: Db): Promise<DailySummaryResult> {
  const result: DailySummaryResult = { companies: 0, activitiesCreated: 0, failedCompanies: 0 };

  const rows = await db
    .select({
      companyId: companies.id,
      defaultLocale: companies.defaultLocale,
      userId: memberships.userId,
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
    .innerJoin(
      memberships,
      and(eq(memberships.companyId, companies.id), eq(memberships.status, 'active')),
    )
    .innerJoin(roles, and(eq(roles.id, memberships.roleId), eq(roles.key, 'owner')));

  const ownerByCompany = new Map<string, { userId: string; defaultLocale: string }>();
  for (const row of rows) {
    if (!ownerByCompany.has(row.companyId)) {
      ownerByCompany.set(row.companyId, { userId: row.userId, defaultLocale: row.defaultLocale });
    }
  }

  for (const [companyId, owner] of ownerByCompany) {
    const locale = (owner.defaultLocale as Locale) ?? 'fr';
    try {
      const args = await loadTenantArgs(owner.userId, companyId, locale, db);
      if (!args.ok) {
        result.failedCompanies += 1;
        continue;
      }
      const created = await withTenant(args.value, (ctx) => summarizeCompany(ctx), db);
      result.companies += 1;
      result.activitiesCreated += created;
    } catch {
      result.failedCompanies += 1;
    }
  }

  return result;
}

async function summarizeCompany(ctx: Ctx): Promise<number> {
  const scope = await leadScope(ctx);
  const open = await ctx.tx
    .select({
      salespersonId: leads.salespersonId,
      createdBy: leads.createdBy,
      stageEnteredAt: leads.stageEnteredAt,
      teamLeaderId: salesTeams.leaderId,
      hasOpenActivity: sql<boolean>`exists (select 1 from ${activities} where ${activities.companyId} = ${leads.companyId} and ${activities.entity} = 'crm.lead' and ${activities.recordId} = ${leads.id} and ${activities.doneAt} is null)`,
    })
    .from(leads)
    .leftJoin(salesTeams, eq(salesTeams.id, leads.teamId))
    .where(
      and(
        eq(leads.companyId, ctx.companyId),
        eq(leads.active, true),
        eq(leads.status, 'open'),
        scope,
      ),
    );

  const totals = new Map<string, UserTotals>();
  const bump = (userId: string, key: keyof UserTotals): void => {
    const t = totals.get(userId) ?? { noActivity: 0, stuck: 0 };
    t[key] += 1;
    totals.set(userId, t);
  };

  const cutoff = Date.now() - STUCK_AFTER_DAYS * DAY_MS;
  for (const lead of open) {
    const owner = lead.salespersonId ?? lead.createdBy;
    if (!lead.hasOpenActivity && owner) bump(owner, 'noActivity');
    if (new Date(lead.stageEnteredAt).getTime() < cutoff) {
      const leader = lead.teamLeaderId ?? owner;
      if (leader) bump(leader, 'stuck');
    }
  }

  const today = todayIso();
  let created = 0;
  for (const [userId, t] of totals) {
    if (t.noActivity + t.stuck === 0) continue;
    const summary = `Daily follow-up: ${t.noActivity} lead(s) without an open activity, ${t.stuck} stuck over ${STUCK_AFTER_DAYS} days`;
    const res = await ensureActivity(ctx, {
      entity: 'crm.daily_summary',
      recordId: userId,
      typeKey: 'todo',
      summary,
      dueDate: today,
      assigneeId: userId,
    });
    if (res.ok && res.value.created) created += 1;
  }
  return created;
}
