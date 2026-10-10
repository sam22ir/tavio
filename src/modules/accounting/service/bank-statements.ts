// Bank and cash statements: create from an import, add lines, match and unmatch entry lines, create the entry for a
// line with no entry, ignore lines, close the statement, and count cash. Every write goes through requirePerm first.
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { audit } from '@/core/audit';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { accounts, bankStatementLines, bankStatementMatches, bankStatements, journalEntries, journalLines } from '../schema';
import { postEntry } from './entries';
import type { DraftLine } from './posting';
import {
  checkCloseable,
  isStatementAccountCode,
  rankProposals,
  runningGap,
  sumLines,
  type EntryCandidate,
  type MatchProposal,
  type ParsedBankLine,
  type StatementLineState,
} from './reconciliation';

export const RECONCILIATION_READ = 'accounting.reconciliation.read';
export const RECONCILIATION_WRITE = 'accounting.reconciliation.write';
const ENTRY_WRITE = 'accounting.entry.write';
const BANK_SOURCE = 'accounting.bank_statement_line';
const CASH_COUNT_SOURCE = 'accounting.cash_count';
const CANDIDATE_LIMIT = 500;

export interface StatementAccountRef {
  id: string;
  code: string;
  name: string;
  isCash: boolean;
}

export interface StatementRow {
  id: string;
  name: string;
  accountId: string;
  accountCode: string;
  dateFrom: string;
  dateTo: string;
  openingBalanceCents: bigint;
  closingBalanceCents: bigint;
  state: 'open' | 'done';
  closedAt: Date | null;
}

export interface StatementLineRow {
  id: string;
  date: string;
  label: string;
  reference: string | null;
  amountCents: bigint;
  state: StatementLineState;
  partnerId: string | null;
  matches: { journalLineId: string; entryNumber: string; date: string; valueCents: bigint }[];
}

export interface StatementView {
  statement: StatementRow;
  lines: StatementLineRow[];
  /** Running difference: closing - opening - accounted lines. Zero when everything is accounted for. */
  gapCents: bigint;
  candidates: (EntryCandidate & { entryDate: string })[];
  proposals: Record<string, MatchProposal[]>;
  counterAccounts: StatementAccountRef[];
}

/** Loads an account usable by a statement: 512, 512x or 53, reconcilable and not archived. */
async function loadStatementAccount(ctx: Ctx, accountId: string): Promise<Result<StatementAccountRef>> {
  const [acc] = await ctx.tx
    .select({ id: accounts.id, code: accounts.code, name: accounts.name, reconcilable: accounts.reconcilable, archived: accounts.archived })
    .from(accounts)
    .where(and(eq(accounts.companyId, ctx.companyId), eq(accounts.id, accountId)));
  if (!acc) return err('NOT_FOUND', 'ACCOUNT_NOT_FOUND');
  if (!isStatementAccountCode(acc.code) || !acc.reconcilable || acc.archived) {
    return err('VALIDATION', 'ACCOUNT_NOT_RECONCILABLE', { messageKey: 'reconciliation.errors.accountNotReconcilable' });
  }
  return ok({ id: acc.id, code: acc.code, name: acc.name, isCash: acc.code === '53' });
}

/** Statement accounts for the import and cash pages (512, 512x, 53). */
export async function listStatementAccounts(ctx: Ctx): Promise<Result<StatementAccountRef[]>> {
  const perm = requirePerm(ctx, RECONCILIATION_READ);
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select({ id: accounts.id, code: accounts.code, name: accounts.name })
    .from(accounts)
    .where(and(eq(accounts.companyId, ctx.companyId), eq(accounts.reconcilable, true), eq(accounts.archived, false)))
    .orderBy(asc(accounts.code));
  return ok(
    rows
      .filter((r) => isStatementAccountCode(r.code))
      .map((r) => ({ id: r.id, code: r.code, name: r.name, isCash: r.code === '53' })),
  );
}

/** Book balance of an account: posted lines dated on or before the given day (YYYY-MM-DD). */
export async function getBookBalance(ctx: Ctx, accountId: string, asOf: string): Promise<bigint> {
  const [row] = await ctx.tx
    .select({ total: sql<string>`coalesce(sum(${journalLines.debitCents} - ${journalLines.creditCents}), 0)::text` })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
    .where(
      and(
        eq(journalLines.companyId, ctx.companyId),
        eq(journalLines.accountId, accountId),
        eq(journalEntries.state, 'posted'),
        sql`${journalEntries.date} <= ${asOf}`,
      ),
    );
  return BigInt(row?.total ?? '0');
}

export interface CreateStatementInput {
  accountId: string;
  name: string;
  openingCents: bigint;
  closingCents: bigint;
  lines: ParsedBankLine[];
}

/** Creates an open statement with its imported lines. The date range comes from the lines. */
export async function createStatement(ctx: Ctx, input: CreateStatementInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, RECONCILIATION_WRITE);
  if (!perm.ok) return perm;
  const name = input.name.trim();
  if (name === '') return err('VALIDATION', 'NAME_REQUIRED');
  if (input.lines.length === 0) return err('VALIDATION', 'STATEMENT_HAS_NO_LINES', { messageKey: 'reconciliation.errors.noLines' });
  const account = await loadStatementAccount(ctx, input.accountId);
  if (!account.ok) return account;

  const dates = input.lines.map((l) => l.date).sort();
  const [stmt] = await ctx.tx
    .insert(bankStatements)
    .values({
      companyId: ctx.companyId,
      accountId: account.value.id,
      name,
      dateFrom: dates[0]!,
      dateTo: dates[dates.length - 1]!,
      openingBalanceCents: input.openingCents,
      closingBalanceCents: input.closingCents,
      state: 'open',
      createdBy: ctx.userId,
    })
    .returning({ id: bankStatements.id });
  if (!stmt) return err('INTERNAL', 'STATEMENT_INSERT_FAILED');

  await ctx.tx.insert(bankStatementLines).values(
    input.lines.map((l) => ({
      companyId: ctx.companyId,
      statementId: stmt.id,
      date: l.date,
      label: l.label,
      reference: l.reference,
      amountCents: l.amountCents,
      state: 'unmatched' as const,
      createdBy: ctx.userId,
    })),
  );

  await audit(ctx, {
    entity: 'accounting.bank_statement',
    recordId: stmt.id,
    action: 'create',
    after: { accountCode: account.value.code, lines: input.lines.length, sum: sumLines(input.lines).toString() },
  });
  return ok({ id: stmt.id });
}

export interface AddLineInput {
  statementId: string;
  date: string;
  label: string;
  reference: string | null;
  amountCents: bigint;
}

/** Adds one line by hand, for example a cash count movement. Only open statements accept lines. */
export async function addStatementLine(ctx: Ctx, input: AddLineInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, RECONCILIATION_WRITE);
  if (!perm.ok) return perm;
  const stmt = await loadOpenStatement(ctx, input.statementId);
  if (!stmt.ok) return stmt;
  if (input.amountCents === BigInt(0)) return err('VALIDATION', 'AMOUNT_ZERO');
  const [line] = await ctx.tx
    .insert(bankStatementLines)
    .values({
      companyId: ctx.companyId,
      statementId: stmt.value.id,
      date: input.date,
      label: input.label,
      reference: input.reference,
      amountCents: input.amountCents,
      state: 'unmatched',
      createdBy: ctx.userId,
    })
    .returning({ id: bankStatementLines.id });
  if (!line) return err('INTERNAL', 'LINE_INSERT_FAILED');
  await ctx.tx
    .update(bankStatements)
    .set({
      dateFrom: sql`least(${bankStatements.dateFrom}, ${input.date}::date)`,
      dateTo: sql`greatest(${bankStatements.dateTo}, ${input.date}::date)`,
      updatedAt: new Date(),
    })
    .where(eq(bankStatements.id, stmt.value.id));
  await audit(ctx, { entity: 'accounting.bank_statement', recordId: stmt.value.id, action: 'add_line', after: { lineId: line.id } });
  return ok({ id: line.id });
}

async function loadOpenStatement(ctx: Ctx, statementId: string): Promise<Result<typeof bankStatements.$inferSelect>> {
  const [stmt] = await ctx.tx
    .select()
    .from(bankStatements)
    .where(and(eq(bankStatements.companyId, ctx.companyId), eq(bankStatements.id, statementId)))
    .for('update');
  if (!stmt) return err('NOT_FOUND', 'STATEMENT_NOT_FOUND');
  if (stmt.state !== 'open') return err('CONFLICT', 'STATEMENT_CLOSED', { messageKey: 'reconciliation.errors.statementClosed' });
  return ok(stmt);
}

async function loadLine(ctx: Ctx, lineId: string): Promise<Result<{ line: typeof bankStatementLines.$inferSelect; statement: typeof bankStatements.$inferSelect }>> {
  const [row] = await ctx.tx
    .select({ line: bankStatementLines, statement: bankStatements })
    .from(bankStatementLines)
    .innerJoin(bankStatements, eq(bankStatements.id, bankStatementLines.statementId))
    .where(and(eq(bankStatementLines.companyId, ctx.companyId), eq(bankStatementLines.id, lineId)))
    .for('update', { of: bankStatementLines });
  if (!row) return err('NOT_FOUND', 'LINE_NOT_FOUND');
  if (row.statement.state !== 'open') return err('CONFLICT', 'STATEMENT_CLOSED', { messageKey: 'reconciliation.errors.statementClosed' });
  return ok(row);
}

/** Unreconciled posted entry lines on an account, for proposals and the manual picker. */
async function unmatchedCandidates(ctx: Ctx, accountId: string): Promise<(EntryCandidate & { entryDate: string })[]> {
  const rows = await ctx.tx
    .select({
      journalLineId: journalLines.id,
      entryDate: journalEntries.date,
      debitCents: journalLines.debitCents,
      creditCents: journalLines.creditCents,
      entryNumber: journalEntries.number,
      entryRef: journalEntries.ref,
      lineLabel: journalLines.label,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
    .leftJoin(bankStatementMatches, eq(bankStatementMatches.journalLineId, journalLines.id))
    .where(
      and(
        eq(journalLines.companyId, ctx.companyId),
        eq(journalLines.accountId, accountId),
        eq(journalEntries.state, 'posted'),
        isNull(bankStatementMatches.id),
      ),
    )
    .orderBy(desc(journalEntries.date), asc(journalLines.id))
    .limit(CANDIDATE_LIMIT);
  return rows.map((r) => ({
    journalLineId: r.journalLineId,
    date: r.entryDate,
    entryDate: r.entryDate,
    valueCents: r.debitCents - r.creditCents,
    entryNumber: r.entryNumber,
    entryRef: r.entryRef,
    lineLabel: r.lineLabel,
  }));
}

/** Everything the statement workbench needs: lines with their links, running difference, candidates and ranked proposals. */
export async function getStatementView(ctx: Ctx, statementId: string): Promise<Result<StatementView>> {
  const perm = requirePerm(ctx, RECONCILIATION_READ);
  if (!perm.ok) return perm;
  const [stmt] = await ctx.tx
    .select({
      id: bankStatements.id,
      name: bankStatements.name,
      accountId: bankStatements.accountId,
      accountCode: accounts.code,
      dateFrom: bankStatements.dateFrom,
      dateTo: bankStatements.dateTo,
      openingBalanceCents: bankStatements.openingBalanceCents,
      closingBalanceCents: bankStatements.closingBalanceCents,
      state: bankStatements.state,
      closedAt: bankStatements.closedAt,
    })
    .from(bankStatements)
    .innerJoin(accounts, eq(accounts.id, bankStatements.accountId))
    .where(and(eq(bankStatements.companyId, ctx.companyId), eq(bankStatements.id, statementId)));
  if (!stmt) return err('NOT_FOUND', 'STATEMENT_NOT_FOUND');

  const lineRows = await ctx.tx
    .select()
    .from(bankStatementLines)
    .where(and(eq(bankStatementLines.companyId, ctx.companyId), eq(bankStatementLines.statementId, statementId)))
    .orderBy(asc(bankStatementLines.date), asc(bankStatementLines.id));

  const matchRows = lineRows.length
    ? await ctx.tx
        .select({
          statementLineId: bankStatementMatches.statementLineId,
          journalLineId: bankStatementMatches.journalLineId,
          entryNumber: journalEntries.number,
          entryDate: journalEntries.date,
          debitCents: journalLines.debitCents,
          creditCents: journalLines.creditCents,
        })
        .from(bankStatementMatches)
        .innerJoin(journalLines, eq(journalLines.id, bankStatementMatches.journalLineId))
        .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
        .innerJoin(bankStatementLines, eq(bankStatementLines.id, bankStatementMatches.statementLineId))
        .where(eq(bankStatementLines.statementId, statementId))
    : [];

  const lines: StatementLineRow[] = lineRows.map((l) => ({
    id: l.id,
    date: l.date,
    label: l.label,
    reference: l.reference,
    amountCents: l.amountCents,
    state: l.state as StatementLineState,
    partnerId: l.partnerId,
    matches: matchRows
      .filter((m) => m.statementLineId === l.id)
      .map((m) => ({ journalLineId: m.journalLineId, entryNumber: m.entryNumber, date: m.entryDate, valueCents: m.debitCents - m.creditCents })),
  }));

  const candidates = stmt.state === 'open' ? await unmatchedCandidates(ctx, stmt.accountId) : [];
  const proposals: Record<string, MatchProposal[]> = {};
  if (stmt.state === 'open') {
    for (const l of lines) {
      if (l.state === 'unmatched') proposals[l.id] = rankProposals(l, candidates);
    }
  }

  const counterRows = await ctx.tx
    .select({ id: accounts.id, code: accounts.code, name: accounts.name })
    .from(accounts)
    .where(and(eq(accounts.companyId, ctx.companyId), eq(accounts.archived, false)))
    .orderBy(asc(accounts.code));
  const counterAccounts = counterRows
    .filter((a) => !isStatementAccountCode(a.code))
    .map((a) => ({ id: a.id, code: a.code, name: a.name, isCash: false }));

  return ok({
    statement: {
      id: stmt.id,
      name: stmt.name,
      accountId: stmt.accountId,
      accountCode: stmt.accountCode,
      dateFrom: stmt.dateFrom,
      dateTo: stmt.dateTo,
      openingBalanceCents: stmt.openingBalanceCents,
      closingBalanceCents: stmt.closingBalanceCents,
      state: stmt.state as 'open' | 'done',
      closedAt: stmt.closedAt,
    },
    lines,
    gapCents: runningGap(stmt.openingBalanceCents, stmt.closingBalanceCents, lines),
    candidates,
    proposals,
    counterAccounts,
  });
}

/** Lists statements, newest first, with the account code. */
export async function listStatements(ctx: Ctx): Promise<Result<StatementRow[]>> {
  const perm = requirePerm(ctx, RECONCILIATION_READ);
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select({
      id: bankStatements.id,
      name: bankStatements.name,
      accountId: bankStatements.accountId,
      accountCode: accounts.code,
      dateFrom: bankStatements.dateFrom,
      dateTo: bankStatements.dateTo,
      openingBalanceCents: bankStatements.openingBalanceCents,
      closingBalanceCents: bankStatements.closingBalanceCents,
      state: bankStatements.state,
      closedAt: bankStatements.closedAt,
    })
    .from(bankStatements)
    .innerJoin(accounts, eq(accounts.id, bankStatements.accountId))
    .where(eq(bankStatements.companyId, ctx.companyId))
    .orderBy(desc(bankStatements.dateTo), desc(bankStatements.createdAt));
  return ok(rows.map((r) => ({ ...r, state: r.state as 'open' | 'done' })));
}

export interface MatchLinesInput {
  lineId: string;
  journalLineIds: string[];
}

/**
 * Links a statement line to one or more entry lines on the statement account. The entry lines must sum to the
 * statement amount, each is linked once company-wide, and each must sit on a posted entry.
 */
export async function matchLine(ctx: Ctx, input: MatchLinesInput): Promise<Result<{ lineId: string }>> {
  const perm = requirePerm(ctx, RECONCILIATION_WRITE);
  if (!perm.ok) return perm;
  const ids = [...new Set(input.journalLineIds)];
  if (ids.length === 0) return err('VALIDATION', 'NO_ENTRY_LINES');
  const loaded = await loadLine(ctx, input.lineId);
  if (!loaded.ok) return loaded;
  const { line, statement } = loaded.value;
  if (line.state !== 'unmatched') return err('CONFLICT', 'LINE_NOT_UNMATCHED', { messageKey: 'reconciliation.errors.lineNotUnmatched' });

  const entryRows = await ctx.tx
    .select({
      id: journalLines.id,
      accountId: journalLines.accountId,
      partnerId: journalLines.partnerId,
      debitCents: journalLines.debitCents,
      creditCents: journalLines.creditCents,
      state: journalEntries.state,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
    .where(and(eq(journalLines.companyId, ctx.companyId), sql`${journalLines.id} in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`));
  if (entryRows.length !== ids.length) return err('NOT_FOUND', 'ENTRY_LINE_NOT_FOUND');
  if (entryRows.some((r) => r.accountId !== statement.accountId || r.state !== 'posted')) {
    return err('VALIDATION', 'ENTRY_LINE_NOT_ON_ACCOUNT', { messageKey: 'reconciliation.errors.wrongAccount' });
  }
  const linked = await ctx.tx
    .select({ id: bankStatementMatches.journalLineId })
    .from(bankStatementMatches)
    .where(and(eq(bankStatementMatches.companyId, ctx.companyId), sql`${bankStatementMatches.journalLineId} in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`));
  if (linked.length > 0) return err('CONFLICT', 'ENTRY_LINE_ALREADY_MATCHED', { messageKey: 'reconciliation.errors.alreadyMatched' });

  const total = entryRows.reduce((acc, r) => acc + (r.debitCents - r.creditCents), BigInt(0));
  if (total !== line.amountCents) {
    return err('CONFLICT', 'MATCH_SUM_MISMATCH', { messageKey: 'reconciliation.errors.sumMismatch' });
  }

  await ctx.tx.insert(bankStatementMatches).values(
    ids.map((journalLineId) => ({ companyId: ctx.companyId, statementLineId: line.id, journalLineId, createdBy: ctx.userId })),
  );
  const partners = [...new Set(entryRows.map((r) => r.partnerId).filter((p): p is string => p !== null))];
  await ctx.tx
    .update(bankStatementLines)
    .set({ state: 'matched', partnerId: partners.length === 1 ? partners[0]! : null })
    .where(eq(bankStatementLines.id, line.id));
  await audit(ctx, { entity: 'accounting.bank_statement_line', recordId: line.id, action: 'match', after: { journalLineIds: ids } });
  return ok({ lineId: line.id });
}

/** Removes all links of a matched line. Allowed only while the statement is open. */
export async function unmatchLine(ctx: Ctx, lineId: string): Promise<Result<{ lineId: string }>> {
  const perm = requirePerm(ctx, RECONCILIATION_WRITE);
  if (!perm.ok) return perm;
  const loaded = await loadLine(ctx, lineId);
  if (!loaded.ok) return loaded;
  const { line } = loaded.value;
  if (line.state !== 'matched') return err('CONFLICT', 'LINE_NOT_MATCHED', { messageKey: 'reconciliation.errors.lineNotMatched' });
  await ctx.tx.delete(bankStatementMatches).where(eq(bankStatementMatches.statementLineId, line.id));
  await ctx.tx
    .update(bankStatementLines)
    .set({ state: 'unmatched', partnerId: null })
    .where(eq(bankStatementLines.id, line.id));
  await audit(ctx, { entity: 'accounting.bank_statement_line', recordId: line.id, action: 'unmatch' });
  return ok({ lineId: line.id });
}

/** Ignores an unmatched line (no entry will be created), or brings an ignored line back to unmatched. */
export async function setLineIgnored(ctx: Ctx, lineId: string, ignored: boolean): Promise<Result<{ lineId: string }>> {
  const perm = requirePerm(ctx, RECONCILIATION_WRITE);
  if (!perm.ok) return perm;
  const loaded = await loadLine(ctx, lineId);
  if (!loaded.ok) return loaded;
  const { line } = loaded.value;
  if (ignored && line.state !== 'unmatched') return err('CONFLICT', 'LINE_NOT_UNMATCHED', { messageKey: 'reconciliation.errors.lineNotUnmatched' });
  if (!ignored && line.state !== 'ignored') return err('CONFLICT', 'LINE_NOT_IGNORED', { messageKey: 'reconciliation.errors.lineNotIgnored' });
  await ctx.tx
    .update(bankStatementLines)
    .set({ state: ignored ? 'ignored' : 'unmatched' })
    .where(eq(bankStatementLines.id, line.id));
  await audit(ctx, { entity: 'accounting.bank_statement_line', recordId: line.id, action: ignored ? 'ignore' : 'unignore' });
  return ok({ lineId: line.id });
}

export interface CreateEntryForLineInput {
  lineId: string;
  counterAccountId: string;
}

/**
 * For a line with no entry (fee, agio, bank charge): posts Dr counter / Cr bank for a debit (money out), or
 * Dr bank / Cr counter for a credit, then matches the bank side of the new entry to the line.
 * Journal: BQ for 512 accounts, CA for the cash account 53.
 */
export async function createEntryForLine(ctx: Ctx, input: CreateEntryForLineInput): Promise<Result<{ entryId: string; number: string }>> {
  const perm = requirePerm(ctx, RECONCILIATION_WRITE);
  if (!perm.ok) return perm;
  const entryPerm = requirePerm(ctx, ENTRY_WRITE);
  if (!entryPerm.ok) return entryPerm;
  const loaded = await loadLine(ctx, input.lineId);
  if (!loaded.ok) return loaded;
  const { line, statement } = loaded.value;
  if (line.state !== 'unmatched') return err('CONFLICT', 'LINE_NOT_UNMATCHED', { messageKey: 'reconciliation.errors.lineNotUnmatched' });
  if (line.amountCents === BigInt(0)) return err('VALIDATION', 'AMOUNT_ZERO');

  const [counter] = await ctx.tx
    .select({ id: accounts.id, code: accounts.code, archived: accounts.archived })
    .from(accounts)
    .where(and(eq(accounts.companyId, ctx.companyId), eq(accounts.id, input.counterAccountId)));
  if (!counter) return err('NOT_FOUND', 'ACCOUNT_NOT_FOUND');
  if (counter.archived) return err('CONFLICT', 'ACCOUNT_ARCHIVED');
  if (isStatementAccountCode(counter.code)) return err('VALIDATION', 'COUNTER_IS_BANK_ACCOUNT', { messageKey: 'reconciliation.errors.counterIsBank' });

  const bank = await loadStatementAccountCode(ctx, statement.accountId);
  if (!bank) return err('NOT_FOUND', 'ACCOUNT_NOT_FOUND');
  const amount = line.amountCents < BigInt(0) ? -line.amountCents : line.amountCents;
  const moneyIn = line.amountCents > BigInt(0);
  const bankLine: DraftLine = { accountCode: bank.code, debitCents: moneyIn ? amount : BigInt(0), creditCents: moneyIn ? BigInt(0) : amount, label: line.label };
  const counterLine: DraftLine = { accountCode: counter.code, debitCents: moneyIn ? BigInt(0) : amount, creditCents: moneyIn ? amount : BigInt(0), label: line.label };

  const posted = await postEntry(ctx, {
    journalCode: bank.code === '53' ? 'CA' : 'BQ',
    date: line.date,
    ref: line.reference,
    sourceEntity: BANK_SOURCE,
    sourceId: line.id,
    lines: [bankLine, counterLine],
  });
  if (!posted.ok) return posted;

  const [bankSide] = await ctx.tx
    .select({ id: journalLines.id })
    .from(journalLines)
    .where(and(eq(journalLines.companyId, ctx.companyId), eq(journalLines.entryId, posted.value.id), eq(journalLines.accountId, statement.accountId)));
  if (!bankSide) return err('INTERNAL', 'BANK_LINE_NOT_FOUND');
  await ctx.tx.insert(bankStatementMatches).values({ companyId: ctx.companyId, statementLineId: line.id, journalLineId: bankSide.id, createdBy: ctx.userId });
  await ctx.tx.update(bankStatementLines).set({ state: 'matched' }).where(eq(bankStatementLines.id, line.id));
  await audit(ctx, { entity: 'accounting.bank_statement_line', recordId: line.id, action: 'create_entry', after: { entryId: posted.value.id, number: posted.value.number } });
  return ok({ entryId: posted.value.id, number: posted.value.number });
}

async function loadStatementAccountCode(ctx: Ctx, accountId: string): Promise<{ code: string } | null> {
  const [row] = await ctx.tx.select({ code: accounts.code }).from(accounts).where(and(eq(accounts.companyId, ctx.companyId), eq(accounts.id, accountId)));
  return row ?? null;
}

/**
 * Closes an open statement when every line is matched or ignored and the closing balance equals opening plus the
 * sum of lines. The entry lines count as reconciled from then on: they are linked to a done statement.
 * Posted lines cannot be updated (immutability trigger), so the reconciled state is derived from the link.
 */
export async function closeStatement(ctx: Ctx, statementId: string): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, RECONCILIATION_WRITE);
  if (!perm.ok) return perm;
  const stmt = await loadOpenStatement(ctx, statementId);
  if (!stmt.ok) return stmt;
  const lines = await ctx.tx
    .select({ amountCents: bankStatementLines.amountCents, state: bankStatementLines.state })
    .from(bankStatementLines)
    .where(eq(bankStatementLines.statementId, statementId));
  const check = checkCloseable(
    stmt.value.openingBalanceCents,
    stmt.value.closingBalanceCents,
    lines.map((l) => ({ amountCents: l.amountCents, state: l.state as StatementLineState })),
  );
  if (!check.ok) return check;
  await ctx.tx
    .update(bankStatements)
    .set({ state: 'done', closedAt: new Date(), updatedAt: new Date() })
    .where(eq(bankStatements.id, statementId));
  await audit(ctx, { entity: 'accounting.bank_statement', recordId: statementId, action: 'close', after: { lines: lines.length } });
  return ok({ id: statementId });
}

export interface CashCountInput {
  accountId: string;
  date: string;
  countedCents: bigint;
}

/**
 * Cash count for account 53. Compares the counted amount to the book balance at the count date and posts the
 * difference: shortage Dr 658 / Cr 53, surplus Dr 53 / Cr 758. The entry is labelled "à vérifier" (to verify).
 */
export async function recordCashCount(ctx: Ctx, input: CashCountInput): Promise<Result<{ diffCents: bigint; entryId: string | null }>> {
  const perm = requirePerm(ctx, RECONCILIATION_WRITE);
  if (!perm.ok) return perm;
  const entryPerm = requirePerm(ctx, ENTRY_WRITE);
  if (!entryPerm.ok) return entryPerm;
  const account = await loadStatementAccount(ctx, input.accountId);
  if (!account.ok) return account;
  if (!account.value.isCash) return err('VALIDATION', 'NOT_CASH_ACCOUNT', { messageKey: 'reconciliation.errors.notCash' });

  const book = await getBookBalance(ctx, account.value.id, input.date);
  const diff = input.countedCents - book;
  if (diff === BigInt(0)) {
    await audit(ctx, { entity: 'accounting.cash_count', recordId: account.value.id, action: 'count', after: { date: input.date, diff: '0' } });
    return ok({ diffCents: BigInt(0), entryId: null });
  }
  const amount = diff < BigInt(0) ? -diff : diff;
  const label = 'Écart de caisse - à vérifier';
  const short = diff < BigInt(0);
  const lines: DraftLine[] = short
    ? [
        { accountCode: '658', debitCents: amount, creditCents: BigInt(0), label },
        { accountCode: '53', debitCents: BigInt(0), creditCents: amount, label },
      ]
    : [
        { accountCode: '53', debitCents: amount, creditCents: BigInt(0), label },
        { accountCode: '758', debitCents: BigInt(0), creditCents: amount, label },
      ];
  const posted = await postEntry(ctx, { journalCode: 'CA', date: input.date, ref: 'CAISSE-ECART', sourceEntity: CASH_COUNT_SOURCE, sourceId: null, lines });
  if (!posted.ok) return posted;
  await audit(ctx, { entity: 'accounting.cash_count', recordId: posted.value.id, action: 'count', after: { date: input.date, diff: diff.toString() } });
  return ok({ diffCents: diff, entryId: posted.value.id });
}

