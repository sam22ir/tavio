// CCP direct debit: pure helpers (no database). Revora's own template, NOT the Algérie Poste format.
// The real Algérie Poste debit file layout and the CCP/RIP key check are not public or verified, so the export goes through
// one function (buildDebitCsv) that a real layout can replace later, and the account number is checked for format only.

export const MAX_RESULT_ROWS = 300;

export type DebitResultStatus = 'paid' | 'rejected';

export interface DebitCsvRow {
  reference: string;
  contract: string;
  customer: string;
  ccpAccount: string;
  amountCents: bigint;
  dueDate: string;
}

export interface DebitResultRow {
  reference: string;
  status: DebitResultStatus;
  reason: string | null;
  /** YYYY-MM-DD, when the file carries one. */
  settledOn: string | null;
}

export interface DebitResultError {
  line: number;
  message: string;
}

/** Digits only, 10 to 20 of them. Spaces, dots and dashes are removed. Format check only. */
export function normalizeCcpAccount(raw: string): string | null {
  const digits = raw.replace(/[\s.\-]/g, '');
  return /^[0-9]{10,20}$/.test(digits) ? digits : null;
}

/** Keeps the last four digits for logs and the audit trail. */
export function maskCcpAccount(account: string): string {
  const tail = account.slice(-4);
  return `${'•'.repeat(Math.max(account.length - 4, 0))}${tail}`;
}

/** 123450n -> '1234,50' (comma decimal so a French-locale spreadsheet reads it as a number). */
export function formatAmountDzd(cents: bigint): string {
  const negative = cents < BigInt(0);
  const abs = negative ? -cents : cents;
  const whole = abs / BigInt(100);
  const frac = (abs % BigInt(100)).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole.toString()},${frac}`;
}

/** First day of the month and last day of the month for 'YYYY-MM'. */
export function monthBounds(month: string): { first: string; last: string } | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]);
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return { first: `${m[1]}-${m[2]}-01`, last: `${m[1]}-${m[2]}-${String(lastDay).padStart(2, '0')}` };
}

/** Quotes a field when needed and neutralises spreadsheet formulas by prefixing a quote (the text itself is kept). */
export function csvField(value: string): string {
  let text = value.replace(/\r?\n/g, ' ');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[;"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const HEADER = ['reference', 'contract', 'customer', 'ccp_account', 'amount_dzd', 'due_date'];

/** Revora debit template: UTF-8 with BOM, ';' separator, CRLF, amounts with a decimal comma. */
export function buildDebitCsv(rows: DebitCsvRow[]): string {
  const lines = [HEADER.join(';')];
  for (const r of rows) {
    lines.push(
      [r.reference, r.contract, r.customer, r.ccpAccount, formatAmountDzd(r.amountCents), r.dueDate].map(csvField).join(';'),
    );
  }
  return `﻿${lines.join('\r\n')}\r\n`;
}

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    if (quoted) {
      if (ch === '"' && line.charAt(i + 1) === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      cells.push(cur);
      cur = '';
    } else cur += ch;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

/**
 * Parses a result file: `reference;status[;reason[;date]]`, ';' or ',' separated, optional header line.
 * status is 'paid' or 'rejected'. Bad lines are reported, not fatal. More than MAX_RESULT_ROWS rows is refused outright.
 */
export function parseResultCsv(text: string): { rows: DebitResultRow[]; errors: DebitResultError[]; tooMany: boolean } {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((l, i) => ({ text: l, line: i + 1 }))
    .filter((l) => l.text.trim() !== '');
  const rows: DebitResultRow[] = [];
  const errors: DebitResultError[] = [];
  if (lines.length === 0) return { rows, errors, tooMany: false };

  const first = lines[0];
  const delimiter = first && first.text.includes(';') ? ';' : ',';
  const body = first && /^reference$/i.test(splitLine(first.text, delimiter)[0] ?? '') ? lines.slice(1) : lines;
  if (body.length > MAX_RESULT_ROWS) return { rows, errors, tooMany: true };

  for (const { text: raw, line } of body) {
    const [reference = '', statusRaw = '', reason = '', date = ''] = splitLine(raw, delimiter);
    const status = statusRaw.toLowerCase();
    if (!reference) {
      errors.push({ line, message: 'MISSING_REFERENCE' });
      continue;
    }
    if (status !== 'paid' && status !== 'rejected') {
      errors.push({ line, message: 'BAD_STATUS' });
      continue;
    }
    if (date !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push({ line, message: 'BAD_DATE' });
      continue;
    }
    rows.push({ reference, status, reason: reason || null, settledOn: date || null });
  }
  return { rows, errors, tooMany: false };
}
