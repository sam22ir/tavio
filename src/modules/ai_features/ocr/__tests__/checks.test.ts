import { describe, expect, it } from 'vitest';
import { billWarnings, duplicateHits, poLineDiffs, suggestOrders, type ExistingBill } from '../checks';

const base = { partnerId: 'p1', origin: 'FAC-7', sourceEntity: null, sourceId: null, date: '2026-03-04', totalCents: BigInt(1011500) };

function bill(over: Partial<ExistingBill> & { id: string }): ExistingBill {
  return { partnerId: 'p1', origin: null, sourceEntity: null, sourceId: null, date: '2026-01-01', totalCents: BigInt(1), state: 'draft', number: null, ...over };
}

describe('billWarnings', () => {
  const lines = [{ quantity: 10, unitPrice: 850, taxRate: 19 }];

  it('is empty when the lines add up to the total within 1 DZD', () => {
    expect(billWarnings({ supplierId: 's', number: 'F1', total: 10115, lines })).toEqual([]);
    expect(billWarnings({ supplierId: 's', number: 'F1', total: 10115.9, lines })).toEqual([]);
  });

  it('flags a total that does not match the lines beyond 1 DZD', () => {
    expect(billWarnings({ supplierId: 's', number: 'F1', total: 10200, lines })).toEqual(['lines_total_mismatch']);
  });

  it('flags a missing supplier and a missing number', () => {
    expect(billWarnings({ supplierId: null, number: null, total: null, lines })).toEqual(['missing_supplier', 'missing_number']);
    expect(billWarnings({ supplierId: 's', number: '  ', total: null, lines })).toEqual(['missing_number']);
  });
});

describe('duplicateHits', () => {
  const fp = { ...base };

  it('matches the same partner on the normalised supplier number', () => {
    const hits = duplicateHits(fp, [bill({ id: 'a', origin: 'fac 7', totalCents: BigInt(5) })]);
    expect(hits.map((h) => [h.id, h.reasons])).toEqual([['a', ['origin']]]);
  });

  it('matches a purchase order that was already billed', () => {
    const hits = duplicateHits(
      { ...fp, origin: 'other', sourceEntity: 'purchases.order', sourceId: 'po1' },
      [bill({ id: 'b', origin: 'x', sourceEntity: 'purchases.order', sourceId: 'po1', totalCents: BigInt(9) })],
    );
    expect(hits[0]?.reasons).toEqual(['purchase_order']);
  });

  it('matches the same date and total', () => {
    const hits = duplicateHits({ ...fp, origin: null }, [bill({ id: 'c', date: fp.date, totalCents: fp.totalCents })]);
    expect(hits[0]?.reasons).toEqual(['date_total']);
  });

  it('ignores cancelled bills and bills of another partner', () => {
    expect(duplicateHits(fp, [bill({ id: 'd', origin: 'FAC-7', state: 'cancelled' })])).toEqual([]);
    expect(duplicateHits(fp, [bill({ id: 'e', origin: 'FAC-7', partnerId: 'p2' })])).toEqual([]);
  });

  it('does not match on unrelated values', () => {
    expect(duplicateHits(fp, [bill({ id: 'f', origin: 'FAC-8', date: '2025-01-01', totalCents: BigInt(3) })])).toEqual([]);
  });
});

describe('suggestOrders', () => {
  const orders = [
    { id: 'o1', number: 'PO-2026-00001', totalCents: BigInt(1011500) },
    { id: 'o2', number: 'PO-2026-00002', totalCents: BigInt(1011000) },
    { id: 'o3', number: 'PO-2026-00003', totalCents: BigInt(5000000) },
  ];

  it('puts an exact reference match first, even when the amount differs', () => {
    const s = suggestOrders({ poReference: 'po 2026 00003', totalCents: BigInt(1011500) }, orders);
    expect(s[0]).toMatchObject({ id: 'o3', reason: 'reference', diffCents: 5000000 - 1011500 });
  });

  it('suggests orders within max(1 DZD, 0.5 %) of the bill total, closest first', () => {
    const s = suggestOrders({ poReference: null, totalCents: BigInt(1011500) }, orders);
    expect(s.map((x) => x.id)).toEqual(['o1', 'o2']);
    expect(s[1]).toMatchObject({ reason: 'amount', diffCents: -500 });
  });

  it('suggests nothing when neither the reference nor the amount fits', () => {
    expect(suggestOrders({ poReference: null, totalCents: BigInt(100) }, orders)).toEqual([]);
  });

  it('returns at most three candidates', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ id: `m${i}`, number: `N${i}`, totalCents: BigInt(1000000 + i) }));
    expect(suggestOrders({ poReference: null, totalCents: BigInt(1000000) }, many)).toHaveLength(3);
  });
});

describe('poLineDiffs', () => {
  it('reports only matched products whose quantity or price differ', () => {
    const diffs = poLineDiffs(
      [
        { productId: 'a', quantity: 10, unitPrice: 850 },
        { productId: 'b', quantity: 2, unitPrice: 100 },
        { productId: null, quantity: 1, unitPrice: 1 },
      ],
      [
        { productId: 'a', quantity: 10, unitPriceCents: BigInt(85000) },
        { productId: 'b', quantity: 2, unitPriceCents: BigInt(9500) },
      ],
    );
    expect(diffs).toEqual([{ lineIndex: 1, orderedQty: 2, scannedQty: 2, orderedUnitCents: 9500, scannedUnitCents: 10000 }]);
  });
});
