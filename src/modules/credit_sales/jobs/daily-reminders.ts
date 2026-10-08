import { and, eq } from 'drizzle-orm';
import type { Ctx, Locale } from '@/core/ctx';
import { withTenant } from '@/core/db/tenant';
import type { Db } from '@/core/db/types';
import { companies, companyModules, memberships, roles } from '@/core/db/schema/tenancy';
import { loadTenantArgs } from '@/core/tenancy/service';
import { ensureActivity } from '@/modules/chatter/service';
import { creditContracts } from '../schema';
import { listDueSoon, listOverdue, type OverdueRow } from '../service/payments';

export interface DailyRemindersResult {
  companies: number;
  dueSoon: number;
  overdue: number;
  activitiesCreated: number;
  failedCompanies: number;
}

const DUE_SOON_DAYS = 3;

// Runs as the owner connection to list companies, then one withTenant transaction per company
// with the company owner as the acting user.
export async function runDailyReminders(db: Db): Promise<DailyRemindersResult> {
  const result: DailyRemindersResult = {
    companies: 0,
    dueSoon: 0,
    overdue: 0,
    activitiesCreated: 0,
    failedCompanies: 0,
  };

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
        eq(companyModules.moduleId, 'credit_sales'),
        eq(companyModules.enabled, true),
      ),
    )
    .innerJoin(
      memberships,
      and(eq(memberships.companyId, companies.id), eq(memberships.status, 'active')),
    )
    .innerJoin(roles, and(eq(roles.id, memberships.roleId), eq(roles.key, 'owner')));

  // One owner per company is enough to run the job.
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
      const counts = await withTenant(
        args.value,
        (ctx) => remindCompany(ctx),
        db,
      );
      result.companies += 1;
      result.dueSoon += counts.dueSoon;
      result.overdue += counts.overdue;
      result.activitiesCreated += counts.activitiesCreated;
    } catch {
      result.failedCompanies += 1;
    }
  }

  return result;
}

async function remindCompany(
  ctx: Ctx,
): Promise<{ dueSoon: number; overdue: number; activitiesCreated: number }> {
  const dueSoon = await listDueSoon(ctx, DUE_SOON_DAYS);
  const overdue = await listOverdue(ctx);

  // Dedupe by installment, since an overdue installment can also appear in the due-soon window.
  const seen = new Set<string>();
  const targets: OverdueRow[] = [];
  for (const row of [...overdue, ...dueSoon]) {
    if (seen.has(row.installmentId)) continue;
    seen.add(row.installmentId);
    targets.push(row);
  }

  let activitiesCreated = 0;
  let dueSoonCount = 0;
  let overdueCount = 0;
  for (const row of targets) {
    if (row.daysLate > 0) overdueCount += 1;
    else dueSoonCount += 1;

    const [contract] = await ctx.tx
      .select({ salespersonId: creditContracts.salespersonId })
      .from(creditContracts)
      .where(eq(creditContracts.id, row.contractId));
    const assigneeId = contract?.salespersonId ?? ctx.userId;

    const res = await ensureActivity(ctx, {
      entity: 'credit_sales.contract',
      recordId: row.contractId,
      typeKey: 'payment_reminder',
      summary: `Installment ${row.seq} of ${row.contractNumber} due ${row.dueDate}`,
      dueDate: row.dueDate,
      assigneeId,
    });
    if (res.ok && res.value.created) activitiesCreated += 1;
  }

  return { dueSoon: dueSoonCount, overdue: overdueCount, activitiesCreated };
}
