// Pure bank reconciliation rules: CSV date and amount parsing, match scoring and ranking, sum matching,
// the close rule and the running difference. No database access, so these are unit tested.
import type { ImportField } from '@/core/io/import';
import { err, ok, type Result } from '@/core/result';

export type StatementLineState = 'unmatched' | 'matched' | 'ignored';

export interface ParsedBankLine {
  date: string;              // YYYY-MM-DD
  label: string;
  reference: string | null;
  amountCents: bigint;       // signed: positive is money in
}

export type ColumnMapping = {
  date: number | null;
  label: number | null;
  reference: number | null;
  debit: number | null;
  credit: number | null;
  amount: number | null;
};

const DAY_MS = 86_400_000;
const DATE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_DMY = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/;
const pad = (n: number): string => String(n).padStart(2, '0');

/** Accepts DD/MM/YYYY (also with . or - and 2-digit years) and YYYY-MM-DD. Returns null for impossible dates. */
export function parseBankDate(input: string): string | null {
  const s = input.trim();
  let y: number;
  let m: number;
  let d: number;
  const iso = DATE_ISO.exec(s);
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else {
    const dmy = DATE_DMY.exec(s);
    if (!dmy) return null;
    d = Number(dmy[1]);
    m = Number(dmy[2]);
    y = Number(dmy[3]);
    if (dmy[3]!.length === 2) y += 2000;
  }
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Parses a bank amount to signed centimes. Handles "1 234,50", "1.234,50", "1,234.50", "1234.5", "-12,00",
 * "(12,00)", "12,00-", "12,00 DA" and non-breaking spaces. A single "." is a decimal point ("1.234" = 1.23 DZD).
 * Returns null for empty or malformed text, or more than two decimals.
 */
export function parseBankAmount(input: string): bigint | null {
  let s = input.replace(/[\s   ]/g, '');
  s = s.replace(/(da|dzd|dinars?)$/i, '');
  if (s === '') return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/^[-−]/.test(s)) {
    negative = !negative;
    s = s.slice(1);
  } else if (/[-−]$/.test(s)) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  const commas = (s.match(/,/g) ?? []).length;
  const dots = (s.match(/\./g) ?? []).length;
  let normalized: string;
  if (commas > 0 && dots > 0) {
    // The separator that appears last is the decimal point; the other one groups thousands.
    const decimalSep = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    const thousandsSep = decimalSep === ',' ? '.' : ',';
    normalized = s.split(thousandsSep).join('').replace(decimalSep, '.');
  } else if (commas > 1) {
    normalized = s.split(',').join('');
  } else if (commas === 1) {
    normalized = s.replace(',', '.');
  } else if (dots > 1) {
    normalized = s.split('.').join('');
  } else {
    normalized = s;
  }
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!m) return null;
  const whole = BigInt(m[1]!);
  const frac = BigInt((m[2] ?? '').padEnd(2, '0'));
  const cents = whole * BigInt(100) + frac;
  return negative ? -cents : cents;
}

/**
 * Maps CSV records (header at index 0) to statement lines using the column mapping.
 * With an amount column, the value is signed. Otherwise amount = credit - debit (credit is money in).
 * Blank rows are skipped. Rows that fail are reported with their line number, not imported.
 */
export function parseBankRows(
  records: readonly string[][],
  mapping: ColumnMapping,
): { lines: ParsedBankLine[]; errors: { row: number; message: string }[] } {
  const lines: ParsedBankLine[] = [];
  const errors: { row: number; message: string }[] = [];
  const cell = (rec: readonly string[], idx: number | null): string =>
    idx === null ? '' : (rec[idx] ?? '').trim();
  records.forEach((rec, i) => {
    if (i === 0) return;
    const row = i + 1;
    if (rec.every((c) => c.trim() === '')) return;
    const date = parseBankDate(cell(rec, mapping.date));
    if (!date) {
      errors.push({ row, message: 'INVALID_DATE' });
      return;
    }
    let amount: bigint | null;
    if (mapping.amount !== null) {
      amount = parseBankAmount(cell(rec, mapping.amount));
    } else {
      const debitText = cell(rec, mapping.debit);
      const creditText = cell(rec, mapping.credit);
      const debit = debitText === '' ? BigInt(0) : parseBankAmount(debitText);
      const credit = creditText === '' ? BigInt(0) : parseBankAmount(creditText);
      amount = debit === null || credit === null ? null : credit - debit;
    }
    if (amount === null) {
      errors.push({ row, message: 'INVALID_AMOUNT' });
      return;
    }
    const reference = cell(rec, mapping.reference);
    lines.push({ date, label: cell(rec, mapping.label), reference: reference === '' ? null : reference, amountCents: amount });
  });
  return { lines, errors };
}

/** Lowercase, accents and punctuation removed. Keeps letters and digits of every script. */
export function normalizeRef(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

export function dayDiff(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00Z`);
  const tb = Date.parse(`${b}T00:00:00Z`);
  return Math.round(Math.abs(ta - tb) / DAY_MS);
}

export interface MatchLineInput {
  date: string;
  label: string;
  reference: string | null;
  amountCents: bigint;
}

export interface EntryCandidate {
  journalLineId: string;
  date: string;
  /** Signed on the bank account: debit minus credit. */
  valueCents: bigint;
  entryNumber: string;
  entryRef: string | null;
  lineLabel: string | null;
}

export interface MatchProposal {
  kind: 'single' | 'group';
  journalLineIds: string[];
  score: number;
  reasons: ('amount' | 'reference' | 'date' | 'sum')[];
}

export const MATCH_WEIGHTS = {
  amount: 60,
  reference: 25,
  dateMax: 15,
  dateWindowDays: 7,
  group: 40,
  groupMaxSize: 4,
  groupPool: 12,
} as const;

/** True when the invoice or payment number of an entry appears in the statement reference or label. */
export function referenceMatches(line: MatchLineInput, cand: EntryCandidate): boolean {
  const hay = normalizeRef(`${line.reference ?? ''} ${line.label}`);
  if (hay === '') return false;
  const keys = [cand.entryNumber, cand.entryRef ?? '', cand.lineLabel ?? '']
    .map(normalizeRef)
    .filter((k) => k.length >= 3);
  return keys.some((k) => hay.includes(k));
}

/** Score of one entry line against a statement line. Null when the amount differs (amount is required). */
export function scoreSingle(line: MatchLineInput, cand: EntryCandidate): { score: number; reasons: MatchProposal['reasons'] } | null {
  if (cand.valueCents !== line.amountCents) return null;
  let score: number = MATCH_WEIGHTS.amount;
  const reasons: MatchProposal['reasons'] = ['amount'];
  if (referenceMatches(line, cand)) {
    score += MATCH_WEIGHTS.reference;
    reasons.push('reference');
  }
  const days = dayDiff(line.date, cand.date);
  if (days <= MATCH_WEIGHTS.dateWindowDays) {
    // Full points on the same day, falling to zero at the edge of the window.
    score += Math.round((MATCH_WEIGHTS.dateMax * (MATCH_WEIGHTS.dateWindowDays - days)) / MATCH_WEIGHTS.dateWindowDays);
    reasons.push('date');
  }
  return { score, reasons };
}

/**
 * Finds the first set of 2..maxSize pool entries whose values sum to target. Pool is searched in the given order,
 * so callers pass the closest candidates first. Returns null when no set matches.
 */
export function findSubsetMatch(
  pool: readonly { id: string; cents: bigint }[],
  target: bigint,
  maxSize: number = MATCH_WEIGHTS.groupMaxSize,
): string[] | null {
  const chosen: string[] = [];
  const search = (start: number, sum: bigint): boolean => {
    if (chosen.length >= 2 && sum === target) return true;
    if (chosen.length === maxSize) return false;
    for (let i = start; i < pool.length; i++) {
      chosen.push(pool[i]!.id);
      if (search(i + 1, sum + pool[i]!.cents)) return true;
      chosen.pop();
    }
    return false;
  };
  return search(0, BigInt(0)) ? [...chosen] : null;
}

/**
 * Ranked proposals for one statement line: single entry lines (amount, then reference, then date) and,
 * when no single line is an exact match, a group of entry lines whose sum equals the statement amount.
 * Ties are broken by date proximity, then journal line id, so the order is stable.
 */
export function rankProposals(line: MatchLineInput, candidates: readonly EntryCandidate[], limit = 5): MatchProposal[] {
  const singles: (MatchProposal & { days: number })[] = [];
  for (const cand of candidates) {
    const s = scoreSingle(line, cand);
    if (!s) continue;
    singles.push({
      kind: 'single',
      journalLineIds: [cand.journalLineId],
      score: s.score,
      reasons: s.reasons,
      days: dayDiff(line.date, cand.date),
    });
  }
  singles.sort((a, b) => b.score - a.score || a.days - b.days || a.journalLineIds[0]!.localeCompare(b.journalLineIds[0]!));
  const result: MatchProposal[] = singles
    .slice(0, limit)
    .map((s) => ({ kind: s.kind, journalLineIds: s.journalLineIds, score: s.score, reasons: s.reasons }));

  // Sum match over the entries closest in date to the statement line, excluding those already proposed alone.
  const pool = candidates
    .filter((c) => c.valueCents !== line.amountCents)
    .map((c) => ({ c, days: dayDiff(line.date, c.date) }))
    .sort((a, b) => a.days - b.days || a.c.journalLineId.localeCompare(b.c.journalLineId))
    .slice(0, MATCH_WEIGHTS.groupPool)
    .map(({ c }) => ({ id: c.journalLineId, cents: c.valueCents }));
  const group = findSubsetMatch(pool, line.amountCents);
  if (group && result.length < limit) {
    result.push({ kind: 'group', journalLineIds: group, score: MATCH_WEIGHTS.group, reasons: ['sum'] });
  }
  return result;
}

/** Sum of the signed values of the given lines. */
export function sumLines(lines: readonly { amountCents: bigint }[]): bigint {
  return lines.reduce((acc, l) => acc + l.amountCents, BigInt(0));
}

/**
 * Running difference shown on the statement: closing minus opening minus what is already accounted for
 * (matched or ignored lines). Zero means everything is accounted for.
 */
export function runningGap(
  openingCents: bigint,
  closingCents: bigint,
  lines: readonly { amountCents: bigint; state: StatementLineState }[],
): bigint {
  const accounted = lines.filter((l) => l.state !== 'unmatched').reduce((acc, l) => acc + l.amountCents, BigInt(0));
  return closingCents - openingCents - accounted;
}

/**
 * Close rule: every line matched or ignored, and closing = opening + sum of all lines (ignored lines included,
 * because they are still on the bank statement).
 */
export function checkCloseable(
  openingCents: bigint,
  closingCents: bigint,
  lines: readonly { amountCents: bigint; state: StatementLineState }[],
): Result<{ sumCents: bigint }> {
  const unmatched = lines.filter((l) => l.state === 'unmatched').length;
  if (unmatched > 0) return err('CONFLICT', `STATEMENT_HAS_UNMATCHED:${unmatched}`, { messageKey: 'reconciliation.errors.hasUnmatched' });
  const sumCents = sumLines(lines);
  if (closingCents !== openingCents + sumCents) {
    return err('CONFLICT', 'STATEMENT_BALANCE_MISMATCH', { messageKey: 'reconciliation.errors.balanceMismatch' });
  }
  return ok({ sumCents });
}

/** Accounts that a bank statement can be attached to: 512 and its sub-accounts, and 53 (cash). */
export function isStatementAccountCode(code: string): boolean {
  return /^512\d*$/.test(code) || code === '53';
}

/** Bank CSV import fields. Labels are i18n keys under accounting.reconciliation.fields. */
export const BANK_IMPORT_FIELDS: readonly ImportField[] = [
  { key: 'date', label: 'date', aliases: ['date', 'date operation', 'date opération', 'date valeur', 'date de valeur', 'تاريخ'], required: true },
  { key: 'label', label: 'label', aliases: ['libelle', 'libellé', 'label', 'description', 'operation', 'opération', 'بيان', 'وصف'] },
  { key: 'reference', label: 'reference', aliases: ['reference', 'référence', 'ref', 'numero', 'numéro', 'مرجع'] },
  { key: 'debit', label: 'debit', aliases: ['debit', 'débit', 'sortie', 'sorties', 'مدين'] },
  { key: 'credit', label: 'credit', aliases: ['credit', 'crédit', 'entree', 'entrée', 'entrees', 'دائن'] },
  { key: 'amount', label: 'amount', aliases: ['montant', 'amount', 'solde', 'المبلغ'] },
];

