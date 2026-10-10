// Accounting export: one ZIP with the journal entries, grand livre, balance, bilan and TCR as XLSX files.
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { toXlsx, zipStored, type IoColumn, type IoRow } from '@/core/io';
import { partners } from '@/modules/contacts/schema';
import { accounts, journalEntries, journalLines, journals } from '../schema';
import { accountTotals, type DateRange } from './reports';
import { BILAN_LINES, TCR_LINES, bilanAt, grandLivreWithOpening, tcrFor, trialBalanceWithOpening } from './statements';

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
}

const money = (key: string, header: string): IoColumn => ({ key, header, type: 'money' });
const text = (key: string, header: string): IoColumn => ({ key, header, type: 'text' });

export interface AccountingExport {
  filename: string;
  bytes: Uint8Array;
}

/** Builds the accounting ZIP for a date range. The bilan and TCR use the range end date. */
export async function buildAccountingExport(
  ctx: Ctx,
  range: DateRange & { from: string; to: string },
  labels: ExportLabels,
  rtl: boolean,
  now: Date = new Date(),
): Promise<AccountingExport> {
  // 1. Journal entries (posted only), one row per line.
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
  const journalRows: IoRow[] = entryRows.map((r) => ({
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
  }));
  const journalCols: IoColumn[] = [
    { key: 'date', header: labels.entryDate, type: 'date' },
    text('number', labels.entryNumber),
    text('journal', labels.journal),
    text('ref', labels.ref),
    text('state', labels.state),
    text('account', labels.account),
    text('accountName', labels.accountName),
    text('partner', labels.partner),
    text('label', labels.label),
    money('debit', labels.debit),
    money('credit', labels.credit),
  ];

  // 2. Grand livre: one block per account with activity in the range, with the carried-forward opening balance.
  const codes = await accountTotals(ctx, range);
  const glRows: IoRow[] = [];
  for (const c of codes) {
    const gl = await grandLivreWithOpening(ctx, c.code, range);
    if (!gl.ok) continue;
    glRows.push({ date: '', number: '', label: `${c.code} ${c.name}`, debit: null, credit: null, balance: gl.value.openingCents });
    for (const r of gl.value.rows) {
      glRows.push({ date: r.date, number: r.number, label: r.label ?? r.ref ?? '', debit: r.debitCents, credit: r.creditCents, balance: r.balanceCents });
    }
  }
  const glCols: IoColumn[] = [
    { key: 'date', header: labels.entryDate, type: 'date' },
    text('number', labels.entryNumber),
    text('label', labels.label),
    money('debit', labels.debit),
    money('credit', labels.credit),
    money('balance', labels.balance),
  ];

  // 3. Balance with opening, movements and closing.
  const trial = await trialBalanceWithOpening(ctx, range);
  const balanceRows: IoRow[] = trial.rows.map((r) => ({
    account: r.code,
    name: r.name,
    opening: r.openingNetCents,
    debit: r.debitCents,
    credit: r.creditCents,
    closing: r.closingNetCents,
  }));
  const balanceCols: IoColumn[] = [
    text('account', labels.account),
    text('name', labels.accountName),
    money('opening', labels.opening),
    money('debit', labels.debit),
    money('credit', labels.credit),
    money('closing', labels.closing),
  ];

  // 4. Bilan at the range end, and TCR over the range.
  const bilan = await bilanAt(ctx, range.to);
  const bilanRows: IoRow[] = [
    ...bilan.actif.map((l) => ({ section: labels.bilanActif, line: BILAN_LINES[l.key], amount: l.amountCents })),
    ...bilan.passif.map((l) => ({ section: labels.bilanPassif, line: BILAN_LINES[l.key], amount: l.amountCents })),
  ];
  const bilanCols: IoColumn[] = [text('section', labels.section), text('line', labels.line), money('amount', labels.amount)];

  const tcr = await tcrFor(ctx, range);
  const tcrRows: IoRow[] = [
    ...tcr.produits.map((l) => ({ section: labels.tcrProduits, line: TCR_LINES[l.key].label, amount: l.amountCents })),
    ...tcr.charges.map((l) => ({ section: labels.tcrCharges, line: TCR_LINES[l.key].label, amount: l.amountCents })),
  ];

  const sheet = (rows: IoRow[], cols: IoColumn[], name: string) => toXlsx(rows, cols, { sheetName: name, rtl, now });
  const stamp = range.to.replace(/-/g, '');
  const entries: { name: string; data: Uint8Array }[] = [
    { name: 'journal-entries.xlsx', data: sheet(journalRows, journalCols, 'Journal') },
    { name: 'grand-livre.xlsx', data: sheet(glRows, glCols, 'Grand livre') },
    { name: 'balance.xlsx', data: sheet(balanceRows, balanceCols, 'Balance') },
    { name: 'bilan.xlsx', data: sheet(bilanRows, bilanCols, 'Bilan') },
    { name: 'tcr.xlsx', data: sheet(tcrRows, bilanCols, 'TCR') },
  ];
  return { filename: `export-comptable-${stamp}.zip`, bytes: zipStored(entries, now) };
}
