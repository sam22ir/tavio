// Period guard: the company lock date and closed fiscal years refuse postings. Used by every posting path.
import { and, eq, lte, gte, sql } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { err, ok, type Result } from '@/core/result';
import { accountingSettings, fiscalYears } from '../schema';

/** Lock date of the company, or null when no lock is set. */
export async function getLockDate(ctx: Ctx): Promise<string | null> {
  const [row] = await ctx.tx
    .select({ lockDate: accountingSettings.lockDate })
    .from(accountingSettings)
    .where(eq(accountingSettings.companyId, ctx.companyId));
  return row?.lockDate ?? null;
}

/**
 * Refuses a posting dated on or before the lock date, or inside a closed fiscal year.
 * Dates are YYYY-MM-DD strings, which compare correctly as text.
 */
export async function assertPeriodOpen(ctx: Ctx, date: string): Promise<Result<{ date: string }>> {
  const lockDate = await getLockDate(ctx);
  if (lockDate && date <= lockDate) {
    return err('CONFLICT', 'PERIOD_LOCKED', { lockDate, date });
  }
  const [closed] = await ctx.tx
    .select({ id: fiscalYears.id, name: fiscalYears.name })
    .from(fiscalYears)
    .where(
      and(
        eq(fiscalYears.companyId, ctx.companyId),
        eq(fiscalYears.state, 'closed'),
        lte(fiscalYears.startDate, date),
        gte(fiscalYears.endDate, date),
      ),
    )
    .limit(1);
  if (closed) return err('CONFLICT', 'FISCAL_YEAR_CLOSED', { fiscalYear: closed.name, date });
  return ok({ date });
}

/** Sets or clears the company lock date. Upserts the settings row. */
export async function setLockDate(ctx: Ctx, lockDate: string | null): Promise<Result<{ lockDate: string | null }>> {
  await ctx.tx
    .insert(accountingSettings)
    .values({ companyId: ctx.companyId, lockDate, createdBy: ctx.userId })
    .onConflictDoUpdate({
      target: [accountingSettings.companyId],
      set: { lockDate, updatedAt: sql`now()` },
    });
  return ok({ lockDate });
}
