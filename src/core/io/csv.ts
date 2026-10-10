import { cellToText, type IoBooleanText, type IoColumn, type IoRow } from './cells';

export type CsvSeparator = ',' | ';' | '\t';

export interface ToCsvOptions {
  separator?: CsvSeparator;   // default ','. French Excel expects ';'
  bom?: boolean;              // default true, so Excel reads UTF-8 (Arabic) correctly
  booleanText?: IoBooleanText;
}

export interface ParsedCsv {
  separator: CsvSeparator;
  records: string[][];        // includes the header record at index 0
}

const CANDIDATE_SEPARATORS: readonly CsvSeparator[] = [',', ';', '\t'];
const NUMERIC = /^-?\d+(\.\d+)?$/;
const BOM = '﻿';

/**
 * Text that spreadsheets would evaluate as a formula. Such text gets a leading apostrophe,
 * so an export cannot run a formula when opened in Excel.
 */
function guardFormula(text: string): string {
  if (/^[=+@\t\r]/.test(text) || (text.startsWith('-') && !NUMERIC.test(text))) return `'${text}`;
  return text;
}

function escapeField(text: string, separator: string): string {
  const safe = guardFormula(text);
  if (safe.includes(separator) || /["\r\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

/** Writes rows as RFC 4180 CSV (CRLF line ends, quoting), UTF-8, with an optional BOM. */
export function toCsv(rows: readonly IoRow[], columns: readonly IoColumn[], opts: ToCsvOptions = {}): Uint8Array {
  const separator = opts.separator ?? ',';
  const bool = opts.booleanText ?? { true: 'true', false: 'false' };
  const lines: string[] = [];
  lines.push(columns.map((c) => escapeField(c.header, separator)).join(separator));
  for (const row of rows) {
    lines.push(
      columns
        .map((c) => escapeField(cellToText(row[c.key], c.type, bool), separator))
        .join(separator),
    );
  }
  const body = lines.join('\r\n') + '\r\n';
  return new TextEncoder().encode(((opts.bom ?? true) ? BOM : '') + body);
}

/** Picks the separator that occurs most often outside quotes in the first record. Ties prefer ','. */
export function detectSeparator(text: string): CsvSeparator {
  const counts = new Map<CsvSeparator, number>(CANDIDATE_SEPARATORS.map((s) => [s, 0]));
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (c === '\n' || c === '\r')) break;
    else if (!inQuotes && (c === ',' || c === ';' || c === '\t')) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best: CsvSeparator = ',';
  for (const s of CANDIDATE_SEPARATORS) {
    if ((counts.get(s) ?? 0) > (counts.get(best) ?? 0)) best = s;
  }
  return best;
}

/** Parses CSV text. Strips a UTF-8 BOM, detects the separator unless given, handles quotes, doubled quotes and CR/LF/CRLF. */
export function parseCsv(input: string, opts: { separator?: CsvSeparator } = {}): ParsedCsv {
  const text = input.startsWith(BOM) ? input.slice(1) : input;
  const separator = opts.separator ?? detectSeparator(text);
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let fieldStarted = false;
  let inQuotes = false;
  const n = text.length;

  for (let i = 0; i < n; i++) {
    const c = text[i] as string;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
    } else if (c === separator) {
      record.push(field);
      field = '';
      fieldStarted = false;
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      fieldStarted = false;
    } else {
      field += c;
      fieldStarted = true;
    }
  }
  if (fieldStarted || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return { separator, records: records.filter((r) => !(r.length === 1 && r[0] === '')) };
}

/** Decodes uploaded bytes as UTF-8 (BOM removed by the parser). */
export function decodeText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}
