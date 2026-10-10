'use server';

// Server actions for bank and cash reconciliation. Each one is a thin wrapper: zod parses the input, then one service runs.
import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
import { parseDzd } from '@/core/money';
import { err, ok, type Result } from '@/core/result';
import { parseCsv, type CsvSeparator } from '@/core/io';
import { autoMapColumns } from '@/core/io/import';
import { BANK_IMPORT_FIELDS } from './service/reconciliation';
import { requireUser } from '@/core/auth/session';
import {
  addStatementLine,
  closeStatement,
  createEntryForLine,
  createStatement,
  matchLine,
  recordCashCount,
  setLineIgnored,
  unmatchLine,
  RECONCILIATION_WRITE,
} from './service/bank-statements';
import { parseBankRows, type ColumnMapping } from './service/reconciliation';

const MODULE = 'accounting';
const idSchema = z.object({ id: z.uuid() });
const amountText = z.string().trim().min(1).max(30);

const mappingSchema = z.object({
  date: z.number().int().nonnegative().nullable(),
  label: z.number().int().nonnegative().nullable(),
  reference: z.number().int().nonnegative().nullable(),
  debit: z.number().int().nonnegative().nullable(),
  credit: z.number().int().nonnegative().nullable(),
  amount: z.number().int().nonnegative().nullable(),
});

export interface BankCsvPreview {
  separator: CsvSeparator;
  headers: string[];
  mapping: ColumnMapping;
  sample: string[][];
  rowCount: number;
}

/** Reads the CSV text and proposes a column mapping. Nothing is stored. */
export async function previewBankCsvAction(text: string): Promise<Result<BankCsvPreview>> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (text.length === 0 || text.length > 2_000_000) return err('VALIDATION', 'FILE_EMPTY_OR_TOO_LARGE', { messageKey: 'reconciliation.errors.file' });
  const parsed = parseCsv(text);
  const [headers, ...rows] = parsed.records;
  if (!headers || headers.length < 2) return err('VALIDATION', 'CSV_NO_HEADER', { messageKey: 'reconciliation.errors.file' });
  const auto = autoMapColumns(headers, BANK_IMPORT_FIELDS);
  const mapping: ColumnMapping = {
    date: auto.date ?? null,
    label: auto.label ?? null,
    reference: auto.reference ?? null,
    debit: auto.debit ?? null,
    credit: auto.credit ?? null,
    amount: auto.amount ?? null,
  };
  return ok({ separator: parsed.separator, headers, mapping, sample: rows.slice(0, 5), rowCount: rows.length });
}

const importSchema = z.object({
  text: z.string().min(1).max(2_000_000),
  mapping: mappingSchema,
  accountId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  openingText: amountText,
  closingText: amountText,
});

const importStatementAction = defineAction(
  { perm: RECONCILIATION_WRITE, schema: importSchema, module: MODULE },
  async (ctx, input) => {
    const opening = parseDzd(input.openingText);
    const closing = parseDzd(input.closingText);
    if (opening === null || closing === null) return err('VALIDATION', 'INVALID_BALANCE', { messageKey: 'reconciliation.errors.balance' });
    if (input.mapping.date === null) return err('VALIDATION', 'DATE_COLUMN_REQUIRED', { messageKey: 'reconciliation.errors.mapping' });
    if (input.mapping.amount === null && input.mapping.debit === null && input.mapping.credit === null) {
      return err('VALIDATION', 'AMOUNT_COLUMN_REQUIRED', { messageKey: 'reconciliation.errors.mapping' });
    }
    const { records } = parseCsv(input.text);
    const { lines, errors } = parseBankRows(records, input.mapping);
    if (errors.length > 0) {
      return err('VALIDATION', `ROW_ERRORS:${errors.length}:${errors.slice(0, 5).map((e) => `${e.row}:${e.message}`).join(',')}`, { messageKey: 'reconciliation.errors.rowErrors' });
    }
    return createStatement(ctx, { accountId: input.accountId, name: input.name, openingCents: opening, closingCents: closing, lines });
  },
);

/** Imports a bank CSV as a new open statement. Refuses the whole file when any row is invalid. */
export async function importBankStatement(input: z.input<typeof importSchema>): Promise<Result<{ id: string }>> {
  return importStatementAction(input);
}

const addLineSchema = z.object({
  statementId: z.uuid(),
  date: z.iso.date(),
  label: z.string().trim().min(1).max(200),
  reference: z.string().trim().max(120).nullable(),
  amount: amountText,
  sign: z.enum(['in', 'out']),
});

const addLineAction = defineAction(
  { perm: RECONCILIATION_WRITE, schema: addLineSchema, module: MODULE },
  (ctx, input) => {
    const cents = parseDzd(input.amount);
    if (cents === null) return Promise.resolve(err('VALIDATION', 'INVALID_AMOUNT', { messageKey: 'reconciliation.errors.amount' }));
    return addStatementLine(ctx, {
      statementId: input.statementId,
      date: input.date,
      label: input.label,
      reference: input.reference,
      amountCents: input.sign === 'in' ? cents : -cents,
    });
  },
);

/** Adds a manual line, for example a cash movement. */
export async function addManualLine(input: z.input<typeof addLineSchema>): Promise<Result<{ id: string }>> {
  return addLineAction(input);
}

const matchSchema = z.object({ lineId: z.uuid(), journalLineIds: z.array(z.uuid()).min(1).max(50) });
const matchAction = defineAction(
  { perm: RECONCILIATION_WRITE, schema: matchSchema, module: MODULE },
  (ctx, input) => matchLine(ctx, input),
);

/** Matches a statement line to one or more entry lines (their sum must equal the line). */
export async function matchStatementLine(input: z.input<typeof matchSchema>): Promise<Result<{ lineId: string }>> {
  return matchAction(input);
}

const unmatchAction = defineAction(
  { perm: RECONCILIATION_WRITE, schema: idSchema, module: MODULE },
  (ctx, { id }) => unmatchLine(ctx, id),
);

export async function unmatchStatementLine(input: { id: string }): Promise<Result<{ lineId: string }>> {
  return unmatchAction(input);
}

const ignoreAction = defineAction(
  { perm: RECONCILIATION_WRITE, schema: z.object({ id: z.uuid(), ignored: z.boolean() }), module: MODULE },
  (ctx, input) => setLineIgnored(ctx, input.id, input.ignored),
);

export async function setStatementLineIgnored(input: { id: string; ignored: boolean }): Promise<Result<{ lineId: string }>> {
  return ignoreAction(input);
}

const createEntrySchema = z.object({ lineId: z.uuid(), counterAccountId: z.uuid() });
const createEntryAction = defineAction(
  { perm: RECONCILIATION_WRITE, schema: createEntrySchema, module: MODULE },
  (ctx, input) => createEntryForLine(ctx, input),
);

/** Posts the entry for a line with no entry (fee, agio) and matches it. */
export async function createEntryFromLine(input: z.input<typeof createEntrySchema>): Promise<Result<{ entryId: string; number: string }>> {
  return createEntryAction(input);
}

const closeAction = defineAction(
  { perm: RECONCILIATION_WRITE, schema: idSchema, module: MODULE },
  (ctx, { id }) => closeStatement(ctx, id),
);

/** Closes the statement when the close rule holds. Closed statements are read-only. */
export async function closeBankStatement(input: { id: string }): Promise<Result<{ id: string }>> {
  return closeAction(input);
}

const cashSchema = z.object({ accountId: z.uuid(), date: z.iso.date(), counted: amountText });
const cashAction = defineAction(
  { perm: RECONCILIATION_WRITE, schema: cashSchema, module: MODULE },
  (ctx, input) => {
    const counted = parseDzd(input.counted);
    if (counted === null) return Promise.resolve(err('VALIDATION', 'INVALID_AMOUNT', { messageKey: 'reconciliation.errors.amount' }));
    return recordCashCount(ctx, { accountId: input.accountId, date: input.date, countedCents: counted });
  },
);

/** Cash count for account 53: posts the difference to 658 or 758, flagged to verify. */
export async function recordCashCountAction(input: z.input<typeof cashSchema>): Promise<Result<{ diffCents: string; entryId: string | null }>> {
  const res = await cashAction(input);
  if (!res.ok) return res;
  return ok({ diffCents: res.value.diffCents.toString(), entryId: res.value.entryId });
}
