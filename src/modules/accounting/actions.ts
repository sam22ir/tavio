'use server';

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { defineAction, toFormAction } from '@/core/actions/define-action';
import { parseDzd } from '@/core/money';
import { err } from '@/core/result';
import type { FormState } from '@/core/entities/types';
import { postEntry, reverseEntry } from './service/entries';
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
  journalCode: z.enum(['VT', 'AC', 'CA', 'BQ', 'OD']),
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

