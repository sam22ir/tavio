import { describe, expect, it, vi } from 'vitest';

vi.mock('@/core/adapters/ai', () => ({
  parseJsonReply: (text: string) => {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as unknown;
    } catch {
      return null;
    }
  },
}));

import { parseOcrReply } from '../parse';
import { matchProduct, matchSupplier } from '../match';

const validBill = {
  supplierName: 'Sarl Atlas',
  supplierNif: '000123456789012',
  date: '2026-03-04',
  number: 'F-889',
  lines: [{ description: 'Ciment 50kg', quantity: 10, unitPrice: 850, taxRate: 19 }],
  total: 10115,
};

describe('parseOcrReply', () => {
  it('accepts a valid bill', () => {
    const res = parseOcrReply(JSON.stringify(validBill));
    expect(res.ok).toBe(true);
  });

  it('rejects malformed JSON', () => {
    const res = parseOcrReply('here is the bill: {supplierName: Atlas');
    expect(res.ok).toBe(false);
  });

  it('rejects a bill with no lines', () => {
    const res = parseOcrReply(JSON.stringify({ ...validBill, lines: [] }));
    expect(res.ok).toBe(false);
  });

  it('rejects a negative price and a bad date', () => {
    expect(parseOcrReply(JSON.stringify({ ...validBill, lines: [{ ...validBill.lines[0], unitPrice: -1 }] })).ok).toBe(false);
    expect(parseOcrReply(JSON.stringify({ ...validBill, date: '04/03/2026' })).ok).toBe(false);
  });
});

describe('matchSupplier', () => {
  const partners = [
    { id: 'p1', nif: '000 123 456 789 012', name: 'Sarl Atlas' },
    { id: 'p2', nif: null, name: 'Bouzid & Fils' },
  ];

  it('matches by NIF digits first', () => {
    expect(matchSupplier({ supplierNif: '000123456789012', supplierName: 'Other' }, partners)).toBe('p1');
  });

  it('falls back to case-insensitive name', () => {
    expect(matchSupplier({ supplierNif: null, supplierName: '  bouzid & fils ' }, partners)).toBe('p2');
  });

  it('returns null when nothing matches', () => {
    expect(matchSupplier({ supplierNif: '999', supplierName: 'Unknown' }, partners)).toBeNull();
  });
});

describe('matchProduct', () => {
  const products = [{ id: 'x1', name: 'Ciment 50kg' }, { id: 'x2', name: 'Fer 12mm' }];

  it('matches by case-insensitive contains', () => {
    expect(matchProduct('CIMENT 50KG sac', products)).toBe('x1');
  });

  it('ignores very short descriptions', () => {
    expect(matchProduct('Fe', products)).toBeNull();
  });
});
