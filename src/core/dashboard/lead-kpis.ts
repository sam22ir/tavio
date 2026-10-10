import { and, asc, count, eq, gte, inArray, notExists, sql } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { activities } from '@/modules/chatter/schema';
import { leads, stages } from '@/modules/crm/schema';
import { leadScope, scopedLeadCount } from '@/modules/crm/service';

export interface StageLeadCount {
  stageId: string;
  name: string;
  position: number;
  count: number;
}

export interface LeadKpis {
  /** Open leads per stage of the company, in stage order. */
  openByStage: StageLeadCount[];
  /** Average days that open leads have spent in their current stage. 0 when there are no open leads. */
  avgDaysInStage: number;
  /** Open leads with no open activity on them. */
  openWithoutActivity: number;
  /** Leads that reached a won stage (stage is_won) since the start of the month. */
  wonThisMonth: number;
  /** Leads created since the start of the month. */
  createdThisMonth: number;
  /** wonThisMonth / createdThisMonth, or null when nothing was created this month. */
  conversionRate: number | null;
}

export const EMPTY_LEAD_KPIS: LeadKpis = {
  openByStage: [],
  avgDaysInStage: 0,
  openWithoutActivity: 0,
  wonThisMonth: 0,
  createdThisMonth: 0,
  conversionRate: null,
};

const MONTH_START = sql`date_trunc('month', now())`;

/** Open lead with no open activity on it. Correlated to the outer leads row. */
function withoutOpenActivity() {
  return notExists(
    sql`(select 1 from ${activities} where ${activities.companyId} = ${leads.companyId} and ${activities.entity} = 'crm.lead' and ${activities.recordId} = ${leads.id} and ${activities.doneAt} is null)`,
  );
}

/**
 * Lead KPIs for the dashboard. Every lead count goes through the crm visibility scope, so a user
 * only sees counts for leads they may see. Without crm.lead.read, every value is zero.
 */
export async function leadKpis(ctx: Ctx): Promise<LeadKpis> {
  const perm = requirePerm(ctx, 'crm.lead.read');
  if (!perm.ok) return EMPTY_LEAD_KPIS;

  const scope = await leadScope(ctx);
  const stageRows = await ctx.tx
    .select({
      stageId: stages.id,
      name: stages.name,
      position: stages.position,
      count: count(leads.id),
      daysInStage: sql<string>`coalesce(sum(extract(epoch from (now() - ${leads.stageEnteredAt})) / 86400), 0)`,
    })
    .from(stages)
    .leftJoin(
      leads,
      and(
        eq(leads.stageId, stages.id),
        eq(leads.companyId, ctx.companyId),
        eq(leads.active, true),
        eq(leads.status, 'open'),
        scope,
      ),
    )
    .where(eq(stages.companyId, ctx.companyId))
    .groupBy(stages.id, stages.name, stages.position)
    .orderBy(asc(stages.position));

  const openByStage = stageRows.map((r) => ({
    stageId: r.stageId,
    name: r.name,
    position: r.position,
    count: Number(r.count),
  }));
  const openTotal = openByStage.reduce((sum, s) => sum + s.count, 0);
  const daysTotal = stageRows.reduce((sum, r) => sum + Number(r.daysInStage), 0);

  const wonStages = ctx.tx
    .select({ id: stages.id })
    .from(stages)
    .where(and(eq(stages.companyId, ctx.companyId), eq(stages.isWon, true)));

  // Sequential: all queries share one transaction connection.
  const openWithoutActivity = await scopedLeadCount(ctx, and(eq(leads.status, 'open'), withoutOpenActivity()));
  const wonThisMonth = await scopedLeadCount(
    ctx,
    and(inArray(leads.stageId, wonStages), gte(leads.wonAt, MONTH_START)),
  );
  const createdThisMonth = await scopedLeadCount(ctx, gte(leads.createdAt, MONTH_START));

  const won = wonThisMonth.ok ? wonThisMonth.value : 0;
  const created = createdThisMonth.ok ? createdThisMonth.value : 0;

  return {
    openByStage,
    avgDaysInStage: openTotal > 0 ? daysTotal / openTotal : 0,
    openWithoutActivity: openWithoutActivity.ok ? openWithoutActivity.value : 0,
    wonThisMonth: won,
    createdThisMonth: created,
    conversionRate: created > 0 ? won / created : null,
  };
}
