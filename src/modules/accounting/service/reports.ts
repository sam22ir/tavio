// Reports over posted entries: trial balance, general ledger, partner balances, G50 VAT draft (⚠).
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { err, ok, type Result } from '@/core/result';
import { partners } from '@/modules/contacts/schema';
import { accounts, journalEntries, journalLines } from '../schema';
import { g50Summary } from './posting';

export interface DateRange { from?: string; to?: string }

function rangeFilters(range: DateRange) {
  return [
    range.from ? gte(journalEntries.date, range.from) : undefined,
    range.to ? lte(journalEntries.date, range.to) : undefined,
  ];
}

/** Per-account debit and credit sums over posted entries. */
export async function accountTotals(ctx: Ctx, range: DateRange = {}, accountCode?: string) {
  const rows = await ctx.tx
    .select({
      code: accounts.code,
      name: accounts.name,
      type: accounts.type,
      debit: sql<string>`coalesce(sum(${journalLines.debitCents}), 0)::text`,
      credit: sql<string>`coalesce(sum(${journalLines.creditCents}), 0)::text`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
    .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
    .where(
      and(
        eq(journalLines.companyId, ctx.companyId),
        eq(journalEntries.state, 'posted'),
        accountCode ? eq(accounts.code, accountCode) : undefined,
        ...rangeFilters(range),
      ),
    )
    .groupBy(accounts.code, accounts.name, accounts.type)
    .orderBy(asc(accounts.code));
  return rows.map((r) => {
    const debit = BigInt(r.debit);
    const credit = BigInt(r.credit);
    return { code: r.code, name: r.name, type: r.type, debitCents: debit, creditCents: credit };
  });
}

/** Trial balance: totals per account, and whether Σdebit = Σcredit overall. */
export async function trialBalance(ctx: Ctx, range: DateRange = {}) {
  const rows = await accountTotals(ctx, range);
  const totalDebit = rows.reduce((s, r) => s + r.debitCents, BigInt(0));
  const totalCredit = rows.reduce((s, r) => s + r.creditCents, BigInt(0));
  return { rows, totalDebitCents: totalDebit, totalCreditCents: totalCredit, balanced: totalDebit === totalCredit };
}

/** General ledger for one account, with a running balance (debit − credit). */
export async function generalLedger(ctx: Ctx, accountCode: string, range: DateRange = {}): Promise<
  Result<{ rows: { date: string; number: string; ref: string | null; label: string | null; debitCents: bigint; creditCents: bigint; balanceCents: bigint }[] }>
> {
  const [account] = await ctx.tx
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.companyId, ctx.companyId), eq(accounts.code, accountCode)));
  if (!account) return err('NOT_FOUND', 'ACCOUNT_NOT_FOUND');

  const lines = await ctx.tx
    .select({
      date: journalEntries.date,
      number: journalEntries.number,
      ref: journalEntries.ref,
      label: journalLines.label,
      debitCents: journalLines.debitCents,
      creditCents: journalLines.creditCents,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
    .where(
      and(
        eq(journalLines.companyId, ctx.companyId),
        eq(journalLines.accountId, account.id),
        eq(journalEntries.state, 'posted'),
        ...rangeFilters(range),
      ),
    )
    .orderBy(asc(journalEntries.date), asc(journalEntries.number), asc(journalLines.id));

  let running = BigInt(0);
  const rows = lines.map((l) => {
    running += l.debitCents - l.creditCents;
    return { ...l, balanceCents: running };
  });
  return ok({ rows });
}

/** Balances per partner on one account (411 clients or 401 suppliers). Balance = debit − credit. */
export async function partnerBalances(ctx: Ctx, accountCode: '411' | '401', range: DateRange = {}) {
  const rows = await ctx.tx
    .select({
      partnerId: journalLines.partnerId,
      partnerName: partners.displayName,
      debit: sql<string>`coalesce(sum(${journalLines.debitCents}), 0)::text`,
      credit: sql<string>`coalesce(sum(${journalLines.creditCents}), 0)::text`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
    .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
    .innerJoin(partners, eq(partners.id, journalLines.partnerId))
    .where(
      and(
        eq(journalLines.companyId, ctx.companyId),
        eq(accounts.code, accountCode),
        eq(journalEntries.state, 'posted'),
        ...rangeFilters(range),
      ),
    )
    .groupBy(journalLines.partnerId, partners.displayName)
    .orderBy(asc(partners.displayName));
  return rows.map((r) => {
    const debit = BigInt(r.debit);
    const credit = BigInt(r.credit);
    return { partnerId: r.partnerId, partnerName: r.partnerName, debitCents: debit, creditCents: credit, balanceCents: debit - credit };
  });
}

/** G50 monthly VAT draft: collected (4457, credit − debit) minus deductible (4456, debit − credit). ⚠ Draft only. */
export async function g50Draft(ctx: Ctx, year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  const totals = await accountTotals(ctx, { from, to });
  const collected = totals.find((t) => t.code === '4457');
  const deductible = totals.find((t) => t.code === '4456');
  const collectedCents = (collected?.creditCents ?? BigInt(0)) - (collected?.debitCents ?? BigInt(0));
  const deductibleCents = (deductible?.debitCents ?? BigInt(0)) - (deductible?.creditCents ?? BigInt(0));
  return { period: { from, to }, ...g50Summary(collectedCents, deductibleCents) };
}
