'use server';

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { defineAction, toFormAction } from '@/core/actions/define-action';
import { parseDzd } from '@/core/money';
import { err } from '@/core/result';
import type { FormState } from '@/core/entities/types';
import { postEntry, reverseEntry } from './service/entries';
import { archiveAccount, createAccount, createJournal, updateAccount, updateJournal } from './service/chart';
import { closeFiscalYear, createFiscalYear } from './service/fiscal';
import { setLockDate } from './service/period';
import { createDraftEntry, deleteDraftEntry, postDraftEntry, updateDraftEntry } from './service/drafts';
import { checkBalanced, type DraftLine } from './service/posting';

const MODULE = 'accounting';
const ENTRY_WRITE = 'accounting.entry.write';

const idInput = z.object({ id: z.uuid() });

const manualLineSchema = z.object({
  accountCode: z.string().trim().min(1).max(12),
  partnerId: z.uuid().nullable().optional(),
  label: z.string().trim().max(200).nullable().optional(),
  debit: z.string().trim().max(30),
  credit: z.string().trim().max(30),
});

const manualEntrySchema = z.object({
  date: z.iso.date(),
  journalCode: z.string().trim().min(1).max(6),
  ref: z.string().trim().max(120).optional(),
  // JSON array of manual lines, sent by the form as a hidden field
  linesJson: z.string().max(50_000),
});

/** Parses form lines: amounts are DZD strings, blank means zero. */
function parseManualLines(json: string): { ok: true; lines: DraftLine[] } | { ok: false } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false };
  }
  const parsed = z.array(manualLineSchema).safeParse(raw);
  if (!parsed.success) return { ok: false };
  const lines: DraftLine[] = [];
  for (const l of parsed.data) {
    const debit = l.debit ? parseDzd(l.debit) : BigInt(0);
    const credit = l.credit ? parseDzd(l.credit) : BigInt(0);
    if (debit === null || credit === null) return { ok: false };
    if (debit === BigInt(0) && credit === BigInt(0)) continue;
    lines.push({
      accountCode: l.accountCode,
      partnerId: l.partnerId ?? null,
      label: l.label || null,
      debitCents: debit,
      creditCents: credit,
    });
  }
  return { ok: true, lines };
}

const createManualEntry = defineAction(
  { perm: ENTRY_WRITE, schema: manualEntrySchema, module: MODULE },
  async (ctx, input) => {
    const parsed = parseManualLines(input.linesJson);
    if (!parsed.ok) return err('VALIDATION', 'ENTRY_LINES_INVALID');
    const balance = checkBalanced(parsed.lines);
    if (!balance.ok) return balance;
    return postEntry(ctx, {
      journalCode: input.journalCode,
      date: input.date,
      ref: input.ref || null,
      lines: parsed.lines,
    });
  },
);

const reverseEntryAction = defineAction(
  { perm: ENTRY_WRITE, schema: idInput, module: MODULE },
  (ctx, { id }) => reverseEntry(ctx, id),
);

/** Form action for /accounting/entries/new. Posts a balanced manual entry. */
export async function createManualEntryForm(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  return toFormAction(createManualEntry, {
    schema: manualEntrySchema,
    redirectTo: ({ id }) => `/${locale}/accounting/entries/${id}`,
  })(prev, formData);
}

/** Reverses a posted entry and returns the reversal's detail page. */
export async function reverseEntryButton(entryId: string): Promise<FormState> {
  const locale = await getLocale();
  const result = await reverseEntryAction({ id: entryId });
  if (!result.ok) return { ok: false, message: result.error.code };
  redirect(`/${locale}/accounting/entries/${result.value.id}`);
}


const ACCOUNTING_CONFIG = 'accounting.account.write';
const JOURNAL_WRITE = 'accounting.journal.write';

const fiscalYearSchema = z.object({
  name: z.string().trim().min(1).max(40),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
});

const lockDateSchema = z.object({
  // Empty string clears the lock.
  lockDate: z.union([z.literal(''), z.iso.date()]),
});

const accountSchema = z.object({
  code: z.string().trim().regex(/^\d{2,8}$/),
  name: z.string().trim().min(1).max(160),
  type: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
  reconcilable: z.boolean().optional(),
});

const journalSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9]{1,6}$/),
  name: z.string().trim().min(1).max(80),
  type: z.enum(['sale', 'purchase', 'cash', 'bank', 'misc']),
});

const draftSchema = z.object({
  id: z.uuid().optional(),
  date: z.iso.date(),
  journalCode: z.string().trim().min(1).max(6),
  ref: z.string().trim().max(120).optional(),
  linesJson: z.string().max(50_000),
});


const createFiscalYearAction = defineAction(
  { perm: ENTRY_WRITE, schema: fiscalYearSchema, module: MODULE },
  (ctx, input) => createFiscalYear(ctx, input),
);

const closeFiscalYearAction = defineAction(
  { perm: ENTRY_WRITE, schema: idInput, module: MODULE },
  (ctx, { id }) => closeFiscalYear(ctx, id),
);

const setLockDateAction = defineAction(
  { perm: ENTRY_WRITE, schema: lockDateSchema, module: MODULE },
  (ctx, { lockDate }) => setLockDate(ctx, lockDate === '' ? null : lockDate),
);

/** Form action: creates a fiscal year on the settings page. */
export async function createFiscalYearForm(prev: FormState, formData: FormData): Promise<FormState> {
  return toFormAction(createFiscalYearAction, { schema: fiscalYearSchema })(prev, formData);
}

/** Form action: sets or clears the company lock date. */
export async function setLockDateForm(prev: FormState, formData: FormData): Promise<FormState> {
  return toFormAction(setLockDateAction, { schema: lockDateSchema })(prev, formData);
}

/** Closes a fiscal year: posts the result and opening entries. Called after the user confirms. */
export async function closeFiscalYearButton(yearId: string): Promise<FormState> {
  const result = await closeFiscalYearAction({ id: yearId });
  if (!result.ok) return { ok: false, message: result.error.code };
  return { ok: true };
}

const createAccountAction = defineAction(
  { perm: ACCOUNTING_CONFIG, schema: accountSchema, module: MODULE },
  (ctx, input) => createAccount(ctx, { code: input.code, name: input.name, type: input.type, reconcilable: input.reconcilable ?? false }),
);

const archiveAccountAction = defineAction(
  { perm: ACCOUNTING_CONFIG, schema: idInput, module: MODULE },
  (ctx, { id }) => archiveAccount(ctx, id),
);

const updateAccountAction = defineAction(
  { perm: ACCOUNTING_CONFIG, schema: accountSchema.partial({ code: true }).extend({ id: z.uuid() }), module: MODULE },
  (ctx, input) => updateAccount(ctx, input.id, { name: input.name, type: input.type, reconcilable: input.reconcilable ?? false }),
);

export async function updateAccountForm(prev: FormState, formData: FormData): Promise<FormState> {
  return toFormAction(updateAccountAction, { schema: accountSchema.partial({ code: true }).extend({ id: z.uuid() }) })(prev, formData);
}

const createJournalAction = defineAction(
  { perm: JOURNAL_WRITE, schema: journalSchema, module: MODULE },
  (ctx, input) => createJournal(ctx, input),
);

const updateJournalAction = defineAction(
  { perm: JOURNAL_WRITE, schema: journalSchema.extend({ id: z.uuid() }), module: MODULE },
  (ctx, input) => updateJournal(ctx, input.id, { name: input.name, type: input.type }),
);

export async function createAccountForm(prev: FormState, formData: FormData): Promise<FormState> {
  return toFormAction(createAccountAction, { schema: accountSchema })(prev, formData);
}

export async function archiveAccountButton(accountId: string): Promise<FormState> {
  const result = await archiveAccountAction({ id: accountId });
  if (!result.ok) return { ok: false, message: result.error.code };
  return { ok: true };
}

export async function createJournalForm(prev: FormState, formData: FormData): Promise<FormState> {
  return toFormAction(createJournalAction, { schema: journalSchema })(prev, formData);
}

export async function updateJournalForm(prev: FormState, formData: FormData): Promise<FormState> {
  return toFormAction(updateJournalAction, { schema: journalSchema.extend({ id: z.uuid() }) })(prev, formData);
}

const draftAction = defineAction(
  { perm: ENTRY_WRITE, schema: draftSchema, module: MODULE },
  async (ctx, input) => {
    const parsed = parseManualLines(input.linesJson);
    if (!parsed.ok) return err('VALIDATION', 'ENTRY_LINES_INVALID');
    const body = { journalCode: input.journalCode, date: input.date, ref: input.ref || null, lines: parsed.lines };
    return input.id ? updateDraftEntry(ctx, input.id, body) : createDraftEntry(ctx, body);
  },
);

const postDraftAction = defineAction(
  { perm: ENTRY_WRITE, schema: idInput, module: MODULE },
  (ctx, { id }) => postDraftEntry(ctx, id),
);

const deleteDraftAction = defineAction(
  { perm: ENTRY_WRITE, schema: idInput, module: MODULE },
  (ctx, { id }) => deleteDraftEntry(ctx, id),
);

/** Saves a manual entry as a draft (creates or updates). */
export async function saveDraftForm(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  return toFormAction(draftAction, {
    schema: draftSchema,
    redirectTo: ({ id }) => `/${locale}/accounting/entries/${id}`,
  })(prev, formData);
}

/** Posts a draft after the balance and period checks. */
export async function postDraftButton(entryId: string): Promise<FormState> {
  const result = await postDraftAction({ id: entryId });
  if (!result.ok) return { ok: false, message: result.error.code };
  return { ok: true };
}

export async function deleteDraftButton(entryId: string): Promise<FormState> {
  const result = await deleteDraftAction({ id: entryId });
  if (!result.ok) return { ok: false, message: result.error.code };
  return { ok: true };
}
