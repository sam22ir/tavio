// Fiscal years: list, create, close (result entry + opening entry in the AN journal), and the lock date.
import { and, asc, eq, sql } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { audit } from '@/core/audit';
import { err, ok, type Result } from '@/core/result';
import { fiscalYears, journals, type FiscalYear } from '../schema';
import { ensureDefaults, OPENING_JOURNAL } from './chart';
import { accountTotals } from './reports';
import { buildOpeningLines, buildResultLines, type Balance } from './closing';
import { postEntry } from './entries';

export { getLockDate, setLockDate, assertPeriodOpen } from './period';

export async function listFiscalYears(ctx: Ctx): Promise<FiscalYear[]> {
  return ctx.tx
    .select()
    .from(fiscalYears)
    .where(eq(fiscalYears.companyId, ctx.companyId))
    .orderBy(asc(fiscalYears.startDate));
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Adds the calendar days: 'YYYY-MM-DD' + n days, in UTC. */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** One year after start, minus one day: the default end of a fiscal year. */
export function defaultYearEnd(start: string): string {
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return addDays(d.toISOString().slice(0, 10), -1);
}

export async function createFiscalYear(
  ctx: Ctx,
  input: { name: string; startDate: string; endDate: string },
): Promise<Result<{ id: string }>> {
  if (!ISO.test(input.startDate) || !ISO.test(input.endDate)) return err('VALIDATION', 'DATE_INVALID');
  if (input.endDate < input.startDate) return err('VALIDATION', 'FISCAL_YEAR_RANGE_INVALID');
  const existing = await listFiscalYears(ctx);
  const overlap = existing.find((y) => y.startDate <= input.endDate && y.endDate >= input.startDate);
  if (overlap) return err('CONFLICT', 'FISCAL_YEAR_OVERLAPS', { with: overlap.name });
  const [row] = await ctx.tx
    .insert(fiscalYears)
    .values({
      companyId: ctx.companyId,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      state: 'open',
      createdBy: ctx.userId,
    })
    .returning({ id: fiscalYears.id });
  if (!row) return err('INTERNAL', 'FISCAL_YEAR_INSERT_FAILED');
  await audit(ctx, { entity: 'accounting.fiscal_year', recordId: row.id, action: 'create', after: input });
  return ok({ id: row.id });
}

/** Cumulative balances per account for posted entries dated on or before `to`. */
async function balancesTo(ctx: Ctx, to: string): Promise<Balance[]> {
  const totals = await accountTotals(ctx, { to });
  return totals.map((t) => ({ code: t.code, debitCents: t.debitCents, creditCents: t.creditCents }));
}

/** Movements of the year only (for the result). */
async function balancesOfYear(ctx: Ctx, from: string, to: string): Promise<Balance[]> {
  const totals = await accountTotals(ctx, { from, to });
  return totals.map((t) => ({ code: t.code, debitCents: t.debitCents, creditCents: t.creditCents }));
}

/** Ensures the AN journal exists, so the opening entry can be posted. */
async function ensureOpeningJournal(ctx: Ctx): Promise<void> {
  await ctx.tx
    .insert(journals)
    .values({ companyId: ctx.companyId, code: OPENING_JOURNAL.code, name: OPENING_JOURNAL.name, type: OPENING_JOURNAL.type, createdBy: ctx.userId })
    .onConflictDoNothing({ target: [journals.companyId, journals.code] });
}

/**
 * Closes an open fiscal year:
 * 1. posts the result entry (classes 6 and 7 into 12) dated on the year end, in OD,
 * 2. marks the year closed,
 * 3. creates the next year if missing, and posts the opening entry (classes 1 to 5) in AN on its first day.
 * ⚠ Needs accountant verification: journal used for the result entry and the AN layout.
 */
export async function closeFiscalYear(ctx: Ctx, yearId: string): Promise<Result<{ resultEntryId: string | null; openingEntryId: string | null; nextYearId: string }>> {
  await ensureDefaults(ctx);
  const [year] = await ctx.tx
    .select()
    .from(fiscalYears)
    .where(and(eq(fiscalYears.companyId, ctx.companyId), eq(fiscalYears.id, yearId)));
  if (!year) return err('NOT_FOUND', 'FISCAL_YEAR_NOT_FOUND');
  if (year.state === 'closed') return err('CONFLICT', 'FISCAL_YEAR_ALREADY_CLOSED');

  // 1. Result entry from the year's class 6 and 7 movements.
  const yearBalances = await balancesOfYear(ctx, year.startDate, year.endDate);
  const resultLines = buildResultLines(yearBalances);
  let resultEntryId: string | null = null;
  if (resultLines.length > 0) {
    const posted = await postEntry(ctx, {
      journalCode: 'OD',
      date: year.endDate,
      ref: `Résultat ${year.name}`,
      sourceEntity: 'accounting.closing',
      sourceId: year.id,
      lines: resultLines,
    });
    if (!posted.ok) return posted;
    resultEntryId = posted.value.id;
  }

  // 2. Mark closed. From here on, postEntry refuses dates inside this year.
  await ctx.tx
    .update(fiscalYears)
    .set({ state: 'closed', closedAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(fiscalYears.id, year.id));

  // 3. Next year, then the opening entry carrying the classes 1 to 5 closing balances.
  const years = await listFiscalYears(ctx);
  let next = years.find((y) => y.startDate === addDays(year.endDate, 1));
  if (!next) {
    const start = addDays(year.endDate, 1);
    const created = await createFiscalYear(ctx, { name: start.slice(0, 4), startDate: start, endDate: defaultYearEnd(start) });
    if (!created.ok) return created;
    next = (await listFiscalYears(ctx)).find((y) => y.id === created.value.id);
    if (!next) return err('INTERNAL', 'FISCAL_YEAR_INSERT_FAILED');
  }

  const closing = await balancesTo(ctx, year.endDate);
  const openingLines = buildOpeningLines(closing);
  let openingEntryId: string | null = null;
  if (openingLines.length > 0) {
    await ensureOpeningJournal(ctx);
    const posted = await postEntry(ctx, {
      journalCode: OPENING_JOURNAL.code,
      date: next.startDate,
      ref: `À nouveaux ${next.name}`,
      sourceEntity: 'accounting.opening',
      sourceId: next.id,
      lines: openingLines,
    });
    if (!posted.ok) return posted;
    openingEntryId = posted.value.id;
  }

  await audit(ctx, { entity: 'accounting.fiscal_year', recordId: year.id, action: 'close', after: { resultEntryId, openingEntryId } });
  return ok({ resultEntryId, openingEntryId, nextYearId: next.id });
}
