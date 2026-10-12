import { describe, expect, it } from 'vitest';
import {
  MAX_RESULT_ROWS,
  buildDebitCsv,
  csvField,
  formatAmountDzd,
  maskCcpAccount,
  monthBounds,
  normalizeCcpAccount,
  parseResultCsv,
} from '../service/debit-file';

describe('normalizeCcpAccount', () => {
  it('keeps 10 to 20 digits and strips spaces, dots and dashes', () => {
    expect(normalizeCcpAccount('0012345678')).toBe('0012345678');
    expect(normalizeCcpAccount('00 12345678-90')).toBe('001234567890');
    expect(normalizeCcpAccount('007 99999 0012345678 12')).toBe('0079999900123456781' + '2');
  });
  it('rejects letters, short and long numbers', () => {
    expect(normalizeCcpAccount('12345')).toBeNull();
    expect(normalizeCcpAccount('00123456789A')).toBeNull();
    expect(normalizeCcpAccount('1'.repeat(21))).toBeNull();
    expect(normalizeCcpAccount('')).toBeNull();
  });
});

describe('maskCcpAccount', () => {
  it('shows only the last four digits', () => {
    expect(maskCcpAccount('0012345678')).toBe('••••••5678');
  });
});

describe('formatAmountDzd', () => {
  it('uses a decimal comma with two digits', () => {
    expect(formatAmountDzd(BigInt(123450))).toBe('1234,50');
    expect(formatAmountDzd(BigInt(5))).toBe('0,05');
    expect(formatAmountDzd(BigInt(0))).toBe('0,00');
    expect(formatAmountDzd(BigInt(-250))).toBe('-2,50');
  });
});

describe('monthBounds', () => {
  it('returns the first and last day, including leap February', () => {
    expect(monthBounds('2026-10')).toEqual({ first: '2026-10-01', last: '2026-10-31' });
    expect(monthBounds('2028-02')).toEqual({ first: '2028-02-01', last: '2028-02-29' });
    expect(monthBounds('2026-02')).toEqual({ first: '2026-02-01', last: '2026-02-28' });
  });
  it('rejects anything that is not YYYY-MM', () => {
    expect(monthBounds('2026-13')).toBeNull();
    expect(monthBounds('2026-1')).toBeNull();
    expect(monthBounds('October')).toBeNull();
  });
});

describe('csvField', () => {
  it('quotes separators and quotes', () => {
    expect(csvField('A;B')).toBe('"A;B"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
  });
  it('neutralises spreadsheet formulas by prefixing a quote, keeping the text', () => {
    expect(csvField('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvField('+213 55')).toBe("'+213 55");
    expect(csvField('-x')).toBe("'-x");
    expect(csvField('@home')).toBe("'@home");
  });
  it('flattens line breaks', () => {
    expect(csvField('a\nb')).toBe('a b');
  });
});

describe('buildDebitCsv', () => {
  it('writes a BOM, the fixed header, CRLF lines and decimal-comma amounts', () => {
    const csv = buildDebitCsv([
      {
        reference: 'PRV-2026-00001-001',
        contract: 'CR-2026-00001',
        customer: 'Amina; Belkacem',
        ccpAccount: '0012345678',
        amountCents: BigInt(1250050),
        dueDate: '2026-10-05',
      },
    ]);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.replace('﻿', '').split('\r\n');
    expect(lines[0]).toBe('reference;contract;customer;ccp_account;amount_dzd;due_date');
    expect(lines[1]).toBe('PRV-2026-00001-001;CR-2026-00001;"Amina; Belkacem";0012345678;12500,50;2026-10-05');
    expect(lines[2]).toBe('');
  });
});

describe('parseResultCsv', () => {
  it('reads paid and rejected rows with optional reason and date, header or not', () => {
    const text = 'reference;status;reason;date\nR-1;paid;;2026-10-06\nR-2;rejected;insufficient funds\nR-3;PAID\n';
    const r = parseResultCsv(text);
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { reference: 'R-1', status: 'paid', reason: null, settledOn: '2026-10-06' },
      { reference: 'R-2', status: 'rejected', reason: 'insufficient funds', settledOn: null },
      { reference: 'R-3', status: 'paid', reason: null, settledOn: null },
    ]);
  });
  it('accepts commas and a BOM', () => {
    const r = parseResultCsv('﻿R-1,paid\r\nR-2,rejected,closed account');
    expect(r.rows.map((x) => x.status)).toEqual(['paid', 'rejected']);
  });
  it('reports bad lines without stopping', () => {
    const r = parseResultCsv('R-1;maybe\n;paid\nR-3;paid;;06/10/2026\nR-4;paid');
    expect(r.errors).toEqual([
      { line: 1, message: 'BAD_STATUS' },
      { line: 2, message: 'MISSING_REFERENCE' },
      { line: 3, message: 'BAD_DATE' },
    ]);
    expect(r.rows).toHaveLength(1);
  });
  it('refuses a file with too many rows', () => {
    const big = Array.from({ length: MAX_RESULT_ROWS + 1 }, (_, i) => `R-${i};paid`).join('\n');
    expect(parseResultCsv(big).tooMany).toBe(true);
    expect(parseResultCsv(big).rows).toHaveLength(0);
  });
  it('returns nothing for an empty file', () => {
    expect(parseResultCsv('  \n')).toEqual({ rows: [], errors: [], tooMany: false });
  });
});
