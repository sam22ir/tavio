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

import { parseOcrReply, OCR_PROMPT } from '../parse';
import { matchProduct, matchSupplier, FUZZY_THRESHOLD, nameSimilarity, type PartnerCandidate } from '../match';

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
    expect(parseOcrReply(JSON.stringify(validBill)).ok).toBe(true);
  });

  it('reads the new identifier, reference and total fields', () => {
    const res = parseOcrReply(
      JSON.stringify({
        ...validBill,
        supplierNis: '123456789012345',
        supplierRc: '16/00-1234567 B 20',
        supplierArticle: '1600123456',
        supplierInvoiceNumber: 'FAC-2026-0007',
        poReference: 'PO-2026-00012',
        subtotal: 8500,
        taxTotal: 1615,
        total: 10115,
      }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.supplierNis).toBe('123456789012345');
      expect(res.value.supplierInvoiceNumber).toBe('FAC-2026-0007');
      expect(res.value.poReference).toBe('PO-2026-00012');
      expect(res.value.taxTotal).toBe(1615);
    }
  });

  it('still accepts a reply without the new fields', () => {
    expect(parseOcrReply(JSON.stringify(validBill)).ok).toBe(true);
  });

  it('tells the model about mixed scripts and Arabic-Indic digits', () => {
    expect(OCR_PROMPT).toContain('Arabic-Indic');
    expect(OCR_PROMPT).toContain('poReference');
  });

  it('rejects malformed JSON', () => {
    expect(parseOcrReply('here is the bill: {supplierName: Atlas').ok).toBe(false);
  });

  it('rejects a bill with no lines', () => {
    expect(parseOcrReply(JSON.stringify({ ...validBill, lines: [] })).ok).toBe(false);
  });

  it('rejects a negative price and a bad date', () => {
    expect(parseOcrReply(JSON.stringify({ ...validBill, lines: [{ ...validBill.lines[0], unitPrice: -1 }] })).ok).toBe(false);
    expect(parseOcrReply(JSON.stringify({ ...validBill, date: '04/03/2026' })).ok).toBe(false);
  });
});

const partner = (over: Partial<PartnerCandidate> & { id: string; name: string }): PartnerCandidate => ({
  nif: null,
  nis: null,
  rc: null,
  article: null,
  ...over,
});

const partners: PartnerCandidate[] = [
  partner({ id: 'p1', name: 'Sarl Atlas', nif: '000 123 456 789 012' }),
  partner({ id: 'p2', name: 'Bouzid & Fils' }),
  partner({ id: 'p3', name: 'Ets Ferraille Oran', nis: '555000111222333' }),
  partner({ id: 'p4', name: 'Rc Only Sarl', rc: '16/00-99999 B 11' }),
  partner({ id: 'p5', name: 'Article Only', article: '1600777' }),
];

describe('matchSupplier', () => {
  it('auto-selects by NIF digits first, whatever the name says', () => {
    const m = matchSupplier({ supplierNif: '000123456789012', supplierName: 'Other' }, partners);
    expect(m).toEqual({ id: 'p1', matchedBy: 'nif', candidates: [] });
  });

  it('reads Arabic-Indic digits in the NIF', () => {
    const m = matchSupplier({ supplierNif: '٠٠٠١٢٣٤٥٦٧٨٩٠١٢' }, partners);
    expect(m.matchedBy).toBe('nif');
    expect(m.id).toBe('p1');
  });

  it('falls through to NIS, RC and article in that order', () => {
    expect(matchSupplier({ supplierNis: '555 000 111 222 333' }, partners).matchedBy).toBe('nis');
    expect(matchSupplier({ supplierRc: '16/00-99999 B 11' }, partners).matchedBy).toBe('rc');
    expect(matchSupplier({ supplierArticle: '1600-777' }, partners).matchedBy).toBe('article');
  });

  it('auto-selects an exact normalised name, ignoring legal suffixes and accents', () => {
    expect(matchSupplier({ supplierName: '  bouzid & fils ' }, partners)).toEqual({ id: 'p2', matchedBy: 'name', candidates: [] });
    expect(matchSupplier({ supplierName: 'ETS FERRAILLE ORAN SARL' }, partners).id).toBe('p3');
  });

  it('returns nothing when no identifier or name is close', () => {
    expect(matchSupplier({ supplierNif: '999', supplierName: 'Unknown Co' }, partners)).toEqual({ id: null, matchedBy: null, candidates: [] });
  });

  it('never auto-selects a fuzzy name: it returns candidates only', () => {
    const m = matchSupplier({ supplierName: 'Atlas Materiaux Batiment' }, [
      partner({ id: 'f1', name: 'Atlas Materiaux' }),
      partner({ id: 'f2', name: 'Oran Ciment' }),
    ]);
    expect(m.id).toBeNull();
    expect(m.matchedBy).toBeNull();
    expect(m.candidates.map((c) => c.id)).toEqual(['f1']);
    expect(m.candidates[0]!.score).toBeGreaterThanOrEqual(FUZZY_THRESHOLD);
  });

  it('returns at most three fuzzy candidates, best first', () => {
    const m = matchSupplier({ supplierName: 'Atlas Materiaux Batiment' }, [
      partner({ id: 'a', name: 'Atlas Materiaux Batiment Oran' }),
      partner({ id: 'b', name: 'Atlas Materiaux Batiment Alger' }),
      partner({ id: 'c', name: 'Atlas Materiaux Batiment Blida' }),
      partner({ id: 'd', name: 'Atlas Materiaux Batiment Tipaza' }),
    ]);
    expect(m.id).toBeNull();
    expect(m.candidates).toHaveLength(3);
  });

  it('an identifier shared by several partners is a choice, not an automatic match', () => {
    const shared = [partner({ id: 'x1', name: 'One', article: '1600' }), partner({ id: 'x2', name: 'Two', article: '1600' })];
    const m = matchSupplier({ supplierArticle: '1600' }, shared);
    expect(m.id).toBeNull();
    expect(m.candidates.map((c) => c.id)).toEqual(['x1', 'x2']);
  });
});

describe('nameSimilarity', () => {
  it('is 1 for identical names and 0 for disjoint ones', () => {
    expect(nameSimilarity('Atlas Oran', 'Oran Atlas')).toBe(1);
    expect(nameSimilarity('Atlas', 'Zebra')).toBe(0);
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
