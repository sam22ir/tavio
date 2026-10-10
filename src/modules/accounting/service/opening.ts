// Opening balances (à nouveaux): one draft manual entry in the AN journal, dated at the fiscal-year start.
// The entry must balance before it is written. Posting it stays a separate, manual step.
import { requirePerm } from '@/core/perms';
import type { Ctx } from '@/core/ctx';
import { err, ok, type Result } from '@/core/result';
import { createDraftEntry } from './drafts';
import { listFiscalYears } from './fiscal';
import type { DraftLine } from './posting';

const ZERO = BigInt(0);

export interface OpeningLine {
  accountCode: string;
  partnerId?: string | null;
  label?: string | null;
  debitCents: bigint;
  creditCents: bigint;
}

/** Sum of debits minus sum of credits. Zero when the opening balances balance. */
export function openingDifference(lines: readonly Pick<OpeningLine, 'debitCents' | 'creditCents'>[]): bigint {
  let debit = ZERO;
  let credit = ZERO;
  for (const l of lines) {
    debit += l.debitCents;
    credit += l.creditCents;
  }
  return debit - credit;
}

/** Picks the fiscal year that contains the date, else the earliest one. Returns its start date. */
function openingDateFor(years: readonly { startDate: string; endDate: string }[], today: string): string | null {
  const current = years.find((y) => y.startDate <= today && today <= y.endDate) ?? years[0];
  return current ? current.startDate : null;
}

/** Writes the opening balances as one draft in journal AN. Refuses when debits and credits differ. */
export async function createOpeningEntry(
  ctx: Ctx,
  input: { lines: readonly OpeningLine[]; today: string },
): Promise<Result<{ id: string; difference: string }>> {
  const perm = requirePerm(ctx, 'accounting.entry.write');
  if (!perm.ok) return perm;
  const lines: DraftLine[] = input.lines.map((l) => ({
    accountCode: l.accountCode,
    partnerId: l.partnerId ?? null,
    label: l.label ?? null,
    debitCents: l.debitCents,
    creditCents: l.creditCents,
  }));
  if (lines.length < 2) return err('VALIDATION', 'OPENING_NEEDS_TWO_LINES');

  const difference = openingDifference(lines);
  if (difference !== ZERO) {
    return err('CONFLICT', 'OPENING_UNBALANCED', { difference: formatCents(difference) });
  }

  const years = await listFiscalYears(ctx);
  const date = openingDateFor(years, input.today);
  if (!date) return err('NOT_FOUND', 'FISCAL_YEAR_NOT_FOUND');
  const year = date.slice(0, 4);

  const created = await createDraftEntry(ctx, { journalCode: 'AN', date, ref: `OUV-${year}`, lines });
  if (!created.ok) return created;
  return ok({ id: created.value.id, difference: '0.00' });
}

/** Signed centimes as a decimal string for messages, e.g. -1250 -> "-12.50". */
export function formatCents(cents: bigint): string {
  const sign = cents < ZERO ? '-' : '';
  const abs = cents < ZERO ? -cents : cents;
  const whole = abs / BigInt(100);
  const frac = (abs % BigInt(100)).toString().padStart(2, '0');
  return `${sign}${whole}.${frac}`;
}
