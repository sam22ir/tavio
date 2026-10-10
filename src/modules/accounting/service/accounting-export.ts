// Accounting export: single report tables (CSV or XLSX) and the ZIP bundle of all reports as XLSX.
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { toXlsx, zipStored, type IoColumn, type IoRow } from '@/core/io';
import { partners } from '@/modules/contacts/schema';
import { accounts, journalEntries, journalLines, journals } from '../schema';
import { accountTotals, type DateRange } from './reports';
import {
  AGING_BUCKETS,
  BILAN_LINES,
  TCR_LINES,
  bilanAt,
  grandLivreWithOpening,
  partnerAging,
  tcrFor,
  trialBalanceWithOpening,
} from './statements';

export interface ExportLabels {
  entryDate: string;
  entryNumber: string;
  journal: string;
  state: string;
  ref: string;
  account: string;
  accountName: string;
  partner: string;
  label: string;
  debit: string;
  credit: string;
  balance: string;
  opening: string;
  closing: string;
  movement: string;
  line: string;
  amount: string;
  section: string;
  bilanActif: string;
  bilanPassif: string;
  tcrProduits: string;
  tcrCharges: string;
  agingBuckets: Record<(typeof AGING_BUCKETS)[number], string>;
}

const money = (key: string, header: string): IoColumn => ({ key, header, type: 'money' });
const text = (key: string, header: string): IoColumn => ({ key, header, type: 'text' });

export interface ReportTable {
  rows: IoRow[];
  columns: IoColumn[];
}

export type ReportKind = 'journal' | 'ledger' | 'balance' | 'bilan' | 'tcr' | 'aging';
export const REPORT_KINDS: readonly ReportKind[] = ['journal', 'ledger', 'balance', 'bilan', 'tcr', 'aging'];

export async function journalTable(ctx: Ctx, range: DateRange & { from: string; to: string }, l: ExportLabels): Promise<ReportTable> {
  const entryRows = await ctx.tx
    .select({
      date: journalEntries.date,
      number: journalEntries.number,
      journal: journals.name,
      ref: journalEntries.ref,
      state: journalEntries.state,
      code: accounts.code,
      accountName: accounts.name,
      partnerName: partners.displayName,
      label: journalLines.label,
      debit: journalLines.debitCents,
      credit: journalLines.creditCents,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
    .innerJoin(journals, eq(journals.id, journalEntries.journalId))
    .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
    .leftJoin(partners, eq(partners.id, journalLines.partnerId))
    .where(
      and(
        eq(journalLines.companyId, ctx.companyId),
        eq(journalEntries.state, 'posted'),
        gte(journalEntries.date, range.from),
        lte(journalEntries.date, range.to),
      ),
    )
    .orderBy(asc(journalEntries.date), asc(journalEntries.number), asc(journalLines.id));
  return {
    rows: entryRows.map((r) => ({
      date: r.date,
      number: r.number,
      journal: r.journal,
      ref: r.ref,
      state: r.state,
      account: r.code,
      accountName: r.accountName,
      partner: r.partnerName ?? '',
      label: r.label ?? '',
      debit: r.debit,
      credit: r.credit,
    })),
    columns: [
      { key: 'date', header: l.entryDate, type: 'date' },
      text('number', l.entryNumber),
      text('journal', l.journal),
      text('ref', l.ref),
      text('state', l.state),
      text('account', l.account),
      text('accountName', l.accountName),
      text('partner', l.partner),
      text('label', l.label),
      money('debit', l.debit),
      money('credit', l.credit),
    ],
  };
}

export async function ledgerTable(ctx: Ctx, range: DateRange, accountCode: string | null, l: ExportLabels): Promise<ReportTable> {
  const codes = accountCode ? [{ code: accountCode, name: accountCode }] : await accountTotals(ctx, range);
  const rows: IoRow[] = [];
  for (const c of codes) {
    const gl = await grandLivreWithOpening(ctx, c.code, range);
    if (!gl.ok) continue;
    rows.push({ date: '', number: '', label: `${c.code} ${c.name}`, debit: null, credit: null, balance: gl.value.openingCents });
    for (const r of gl.value.rows) {
      rows.push({ date: r.date, number: r.number, label: r.label ?? r.ref ?? '', debit: r.debitCents, credit: r.creditCents, balance: r.balanceCents });
    }
  }
  return {
    rows,
    columns: [
      { key: 'date', header: l.entryDate, type: 'date' },
      text('number', l.entryNumber),
      text('label', l.label),
      money('debit', l.debit),
      money('credit', l.credit),
      money('balance', l.balance),
    ],
  };
}

export async function balanceTable(ctx: Ctx, range: DateRange, l: ExportLabels): Promise<ReportTable> {
  const trial = await trialBalanceWithOpening(ctx, range);
  return {
    rows: trial.rows.map((r) => ({
      account: r.code,
      name: r.name,
      opening: r.openingNetCents,
      debit: r.debitCents,
      credit: r.creditCents,
      closing: r.closingNetCents,
    })),
    columns: [
      text('account', l.account),
      text('name', l.accountName),
      money('opening', l.opening),
      money('debit', l.debit),
      money('credit', l.credit),
      money('closing', l.closing),
    ],
  };
}

export async function bilanTable(ctx: Ctx, asOf: string, l: ExportLabels): Promise<ReportTable> {
  const bilan = await bilanAt(ctx, asOf);
  return {
    rows: [
      ...bilan.actif.map((x) => ({ section: l.bilanActif, line: BILAN_LINES[x.key], amount: x.amountCents })),
      ...bilan.passif.map((x) => ({ section: l.bilanPassif, line: BILAN_LINES[x.key], amount: x.amountCents })),
    ],
    columns: [text('section', l.section), text('line', l.line), money('amount', l.amount)],
  };
}

export async function tcrTable(ctx: Ctx, range: DateRange, l: ExportLabels): Promise<ReportTable> {
  const tcr = await tcrFor(ctx, range);
  return {
    rows: [
      ...tcr.produits.map((x) => ({ section: l.tcrProduits, line: TCR_LINES[x.key].label, amount: x.amountCents })),
      ...tcr.charges.map((x) => ({ section: l.tcrCharges, line: TCR_LINES[x.key].label, amount: x.amountCents })),
    ],
    columns: [text('section', l.section), text('line', l.line), money('amount', l.amount)],
  };
}

export async function agingTable(ctx: Ctx, asOf: string, l: ExportLabels): Promise<ReportTable> {
  const rows = await partnerAging(ctx, asOf, '411');
  return {
    rows: rows.map((r) => ({
      partner: r.partnerName,
      b0: r.buckets['0-30'],
      b1: r.buckets['31-60'],
      b2: r.buckets['61-90'],
      b3: r.buckets['90+'],
      total: r.totalCents,
    })),
    columns: [
      text('partner', l.partner),
      money('b0', l.agingBuckets['0-30']),
      money('b1', l.agingBuckets['31-60']),
      money('b2', l.agingBuckets['61-90']),
      money('b3', l.agingBuckets['90+']),
      money('total', l.balance),
    ],
  };
}

/** One report as a table. `from`/`to` bound the period; the bilan and aging use `to` as the date. */
export async function reportTable(
  ctx: Ctx,
  kind: ReportKind,
  range: DateRange & { from: string; to: string },
  l: ExportLabels,
  account: string | null,
): Promise<ReportTable> {
  switch (kind) {
    case 'journal':
      return journalTable(ctx, range, l);
    case 'ledger':
      return ledgerTable(ctx, range, account, l);
    case 'balance':
      return balanceTable(ctx, range, l);
    case 'bilan':
      return bilanTable(ctx, range.to, l);
    case 'tcr':
      return tcrTable(ctx, range, l);
    case 'aging':
      return agingTable(ctx, range.to, l);
  }
}

export interface AccountingExport {
  filename: string;
  bytes: Uint8Array;
}

/** ZIP of the journal entries, grand livre, balance, bilan and TCR, each as XLSX. */
export async function buildAccountingExport(
  ctx: Ctx,
  range: DateRange & { from: string; to: string },
  labels: ExportLabels,
  rtl: boolean,
  now: Date = new Date(),
): Promise<AccountingExport> {
  const sheet = (t: ReportTable, name: string) => toXlsx(t.rows, t.columns, { sheetName: name, rtl, now });
  const files = [
    { name: 'journal-entries.xlsx', data: sheet(await journalTable(ctx, range, labels), 'Journal') },
    { name: 'grand-livre.xlsx', data: sheet(await ledgerTable(ctx, range, null, labels), 'Grand livre') },
    { name: 'balance.xlsx', data: sheet(await balanceTable(ctx, range, labels), 'Balance') },
    { name: 'bilan.xlsx', data: sheet(await bilanTable(ctx, range.to, labels), 'Bilan') },
    { name: 'tcr.xlsx', data: sheet(await tcrTable(ctx, range, labels), 'TCR') },
  ];
  return { filename: `export-comptable-${range.to.replace(/-/g, '')}.zip`, bytes: zipStored(files, now) };
}
