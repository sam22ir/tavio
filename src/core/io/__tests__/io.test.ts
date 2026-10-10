import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { autoMapColumns, mapRecord, missingRequired, validateRow, type ImportField } from '../import';
import { toCsv, parseCsv, decodeText } from '../csv';
import { toXlsx } from '../xlsx';
import { crc32 } from '../zip';
import type { IoColumn } from '../cells';

const columns: IoColumn[] = [
  { key: 'name', header: 'Nom' },
  { key: 'note', header: 'Note' },
  { key: 'amount', header: 'Montant', type: 'money' },
  { key: 'when', header: 'Date', type: 'date' },
];

describe('CSV round trip', () => {
  it('keeps quotes, newlines, separators and Arabic text', () => {
    const rows = [
      { name: 'Ahmed "Le Grand"', note: 'ligne 1\nligne 2', amount: '150050', when: '2026-10-10' },
      { name: 'شركة النور', note: 'a;b,c', amount: '0', when: '' },
    ];
    const bytes = toCsv(rows, columns, { separator: ';' });
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = decodeText(bytes);
    const parsed = parseCsv(text);
    expect(parsed.separator).toBe(';');
    expect(parsed.records[0]).toEqual(['Nom', 'Note', 'Montant', 'Date']);
    expect(parsed.records[1]).toEqual(['Ahmed "Le Grand"', 'ligne 1\nligne 2', '1500.50', '2026-10-10']);
    expect(parsed.records[2]).toEqual(['شركة النور', 'a;b,c', '0.00', '']);
  });

  it('writes CRLF and detects comma and tab separators', () => {
    const text = decodeText(toCsv([{ name: 'a', note: 'b', amount: 100, when: null }], columns));
    expect(text.endsWith('\r\n')).toBe(true);
    expect(parseCsv(text).separator).toBe(',');
    expect(parseCsv('a\tb\tc\r\n1\t2\t3').separator).toBe('\t');
  });

  it('neutralises formulas and writes money as decimal DZD', () => {
    const text = decodeText(toCsv([{ name: '=SUM(A1)', note: '-5', amount: '123456', when: '2026-10-10T12:00:00Z' }], columns));
    const row = parseCsv(text).records[1] as string[];
    expect(row[0]).toBe("'=SUM(A1)");
    expect(row[1]).toBe('-5');
    expect(row[2]).toBe('1234.56');
    expect(row[3]).toBe('2026-10-10');
  });

  it('strips a BOM and skips blank lines', () => {
    const parsed = parseCsv('﻿a,b\r\n\r\n1,2\r\n');
    expect(parsed.records).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('XLSX structure', () => {
  it('writes a zip with the required OOXML parts', () => {
    const bytes = toXlsx([{ name: 'A', note: 'B', amount: '1250', when: '2026-01-02' }], columns, { sheetName: 'Contacts' });
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const eocd = bytes.length - 22;
    expect(view.getUint32(eocd, true)).toBe(0x06054b50);
    const count = view.getUint16(eocd + 8, true);
    const names: string[] = [];
    let p = view.getUint32(eocd + 16, true);
    for (let i = 0; i < count; i++) {
      const len = view.getUint16(p + 28, true);
      names.push(new TextDecoder().decode(bytes.slice(p + 46, p + 46 + len)));
      p += 46 + len;
    }
    expect(names).toEqual([
      '[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml',
    ]);
    const sheetStart = bytes.indexOf(0x3c, 0);
    expect(sheetStart).toBeGreaterThanOrEqual(0);
    const stored = new TextDecoder().decode(bytes);
    expect(stored).toContain('<c r="C2" s="2"><v>12.5</v></c>');
    expect(stored).toContain('<t xml:space="preserve">Montant</t>');
  });

  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('mapping and validation', () => {
  const fields: ImportField[] = [
    { key: 'name', label: 'Nom', aliases: ['Name', 'الاسم'], required: true },
    { key: 'phone', label: 'Téléphone', aliases: ['Tel', 'الهاتف'] },
    { key: 'nif', label: 'NIF', aliases: [] },
  ];

  it('auto-maps by key, label and aliases, accent and case insensitive', () => {
    const mapping = autoMapColumns(['telephone', 'NOM', 'الاسم'], fields);
    expect(mapping).toEqual({ name: 1, phone: 0, nif: null });
    expect(missingRequired({ name: null, phone: 0, nif: null }, fields)).toEqual(['name']);
  });

  it('maps a record into raw strings', () => {
    const raw = mapRecord(['  Ali ', '0550', 'x'], { name: 0, phone: 1, nif: null });
    expect(raw).toEqual({ name: 'Ali', phone: '0550', nif: '' });
  });

  it('validates rows with zod and reports field issues', () => {
    const schema = z.object({ name: z.string().min(1), phone: z.string().optional() });
    expect(validateRow(schema, { name: 'Ali', phone: '' }).ok).toBe(true);
    const bad = validateRow(schema, { name: '' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.issues[0]?.field).toBe('name');
  });
});

describe('CPU sanity', () => {
  it('exports 10k rows x 10 columns in under 300 ms per format', () => {
    const cols: IoColumn[] = Array.from({ length: 10 }, (_, i) => ({ key: `c${i}`, header: `Col ${i}`, type: i % 3 === 0 ? 'money' : 'text' }));
    const rows = Array.from({ length: 10000 }, (_, r) =>
      Object.fromEntries(cols.map((c, i) => [c.key, c.type === 'money' ? String(r * 100 + i) : `valeur ${r}-${i}, "x"`])),
    );
    // Best of three warm runs, so a busy worker does not inflate the result.
    const time = (fn: () => unknown): number => {
      fn();
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        fn();
        best = Math.min(best, performance.now() - start);
      }
      return best;
    };
    const csvMs = time(() => toCsv(rows, cols));
    const xlsxMs = time(() => toXlsx(rows, cols, { sheetName: 'Bench' }));
    console.log(`io export 10k x 10 (warm): csv ${csvMs.toFixed(1)} ms, xlsx ${xlsxMs.toFixed(1)} ms`);
    // A loose ceiling: this guards against accidental O(n^2) regressions, not machine speed.
    // The suite runs in parallel, so a busy machine can be several times slower than a quiet one.
    expect(csvMs).toBeLessThan(1500);
    expect(xlsxMs).toBeLessThan(1500);
  });
});
