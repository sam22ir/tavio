import { and, eq, sql } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { companyModules } from '@/core/db/schema';
import { creditContracts, creditInstallments, creditPayments } from '@/modules/credit_sales/schema';
import { leads } from '@/modules/crm/schema';

export interface DashboardKpis {
  dueTodayCents: bigint;
  dueTodayCount: number;
  overdueCents: bigint;
  overdueCount: number;
  collectedThisMonthCents: bigint;
  activeContracts: number;
  openLeads: number;
}

const ZERO_KPIS: DashboardKpis = {
  dueTodayCents: 0n,
  dueTodayCount: 0,
  overdueCents: 0n,
  overdueCount: 0,
  collectedThisMonthCents: 0n,
  activeContracts: 0,
  openLeads: 0,
};

/** Enabled module ids for the current company, read inside the tenant transaction. */
async function enabledModuleIds(ctx: Ctx): Promise<Set<string>> {
  const rows = await ctx.tx
    .select({ moduleId: companyModules.moduleId })
    .from(companyModules)
    .where(and(eq(companyModules.companyId, ctx.companyId), eq(companyModules.enabled, true)));
  return new Set(rows.map((r) => r.moduleId));
}

/**
 * Dashboard KPIs for the active company. A value whose module is disabled is 0.
 * Due today and overdue cover unpaid installments of active contracts.
 */
export async function dashboardKpis(ctx: Ctx): Promise<DashboardKpis> {
  const modules = await enabledModuleIds(ctx);
  const kpis: DashboardKpis = { ...ZERO_KPIS };

  if (modules.has('credit_sales')) {
    const [inst] = await ctx.tx
      .select({
        dueToday: sql<string>`coalesce(sum(case when ${creditInstallments.dueDate} = current_date then ${creditInstallments.amountCents} - ${creditInstallments.paidCents} else 0 end), 0)`,
        dueTodayCount: sql<string>`count(*) filter (where ${creditInstallments.dueDate} = current_date)`,
        overdue: sql<string>`coalesce(sum(case when ${creditInstallments.dueDate} < current_date then ${creditInstallments.amountCents} - ${creditInstallments.paidCents} else 0 end), 0)`,
        overdueCount: sql<string>`count(*) filter (where ${creditInstallments.dueDate} < current_date)`,
      })
      .from(creditInstallments)
      .innerJoin(creditContracts, eq(creditContracts.id, creditInstallments.contractId))
      .where(
        and(
          eq(creditInstallments.companyId, ctx.companyId),
          eq(creditContracts.state, 'active'),
          sql`${creditInstallments.paidCents} < ${creditInstallments.amountCents}`,
          sql`${creditInstallments.dueDate} <= current_date`,
        ),
      );
    const [collected] = await ctx.tx
      .select({
        total: sql<string>`coalesce(sum(${creditPayments.amountCents}), 0)`,
      })
      .from(creditPayments)
      .where(
        and(
          eq(creditPayments.companyId, ctx.companyId),
          eq(creditPayments.state, 'posted'),
          sql`${creditPayments.receivedAt} >= date_trunc('month', now())`,
        ),
      );
    const [contracts] = await ctx.tx
      .select({ n: sql<string>`count(*)` })
      .from(creditContracts)
      .where(and(eq(creditContracts.companyId, ctx.companyId), eq(creditContracts.state, 'active')));

    kpis.dueTodayCents = BigInt(inst?.dueToday ?? 0);
    kpis.dueTodayCount = Number(inst?.dueTodayCount ?? 0);
    kpis.overdueCents = BigInt(inst?.overdue ?? 0);
    kpis.overdueCount = Number(inst?.overdueCount ?? 0);
    kpis.collectedThisMonthCents = BigInt(collected?.total ?? 0);
    kpis.activeContracts = Number(contracts?.n ?? 0);
  }

  if (modules.has('crm')) {
    const [row] = await ctx.tx
      .select({ n: sql<string>`count(*)` })
      .from(leads)
      .where(and(eq(leads.companyId, ctx.companyId), eq(leads.status, 'open'), eq(leads.active, true)));
    kpis.openLeads = Number(row?.n ?? 0);
  }

  return kpis;
}
