import { describe, expect, it } from 'vitest';
import { classifyStockMove, nextAverageCost, roundDiv } from '../service/valuation';

describe('nextAverageCost', () => {
  it('averages two receipts at different prices (10 @ 100, 10 @ 200 -> 150)', () => {
    const first = nextAverageCost({ onHandMilli: 0n, avgCostCents: 0n }, 10_000n, { direction: 'in', unitCostCents: 100n });
    expect(first.avgCostCents).toBe(100n);
    const second = nextAverageCost({ onHandMilli: 10_000n, avgCostCents: first.avgCostCents }, 10_000n, { direction: 'in', unitCostCents: 200n });
    expect(second.avgCostCents).toBe(150n);
    expect(second.valueCents).toBe(2000n);
  });

  it('books outgoing moves at the current average without changing it', () => {
    const out = nextAverageCost({ onHandMilli: 20_000n, avgCostCents: 150n }, 5_000n, { direction: 'out' });
    expect(out.unitCostCents).toBe(150n);
    expect(out.valueCents).toBe(750n);
    expect(out.avgCostCents).toBe(150n);
  });

  it('keeps the average on a receipt that costs the same as the average', () => {
    const r = nextAverageCost({ onHandMilli: 5_000n, avgCostCents: 150n }, 5_000n, { direction: 'in', unitCostCents: 150n });
    expect(r.avgCostCents).toBe(150n);
  });

  it('rounds the new average to the cent, half up', () => {
    // (1 x 100 + 2 x 101) / 3 = 100.666... -> 101
    const r = nextAverageCost({ onHandMilli: 1_000n, avgCostCents: 100n }, 2_000n, { direction: 'in', unitCostCents: 101n });
    expect(r.avgCostCents).toBe(101n);
  });

  it('resets the average to the incoming cost when stock is zero', () => {
    const r = nextAverageCost({ onHandMilli: 0n, avgCostCents: 150n }, 4_000n, { direction: 'in', unitCostCents: 300n });
    expect(r.avgCostCents).toBe(300n);
    expect(r.valueCents).toBe(1200n);
  });

  it('resets the average when stock is negative', () => {
    const r = nextAverageCost({ onHandMilli: -2_000n, avgCostCents: 150n }, 4_000n, { direction: 'in', unitCostCents: 300n });
    expect(r.avgCostCents).toBe(300n);
  });

  it('values a customer return at the original delivery cost it is given', () => {
    const r = nextAverageCost({ onHandMilli: 5_000n, avgCostCents: 200n }, 1_000n, { direction: 'in', unitCostCents: 120n });
    expect(r.unitCostCents).toBe(120n);
    expect(r.valueCents).toBe(120n);
    expect(r.avgCostCents).toBe(187n);
  });

  it('rejects a non-positive quantity', () => {
    expect(() => nextAverageCost({ onHandMilli: 0n, avgCostCents: 0n }, 0n, { direction: 'out' })).toThrow(RangeError);
  });
});

describe('roundDiv and classifyStockMove', () => {
  it('rounds half up and handles negatives symmetrically', () => {
    expect(roundDiv(5n, 2n)).toBe(3n);
    expect(roundDiv(-5n, 2n)).toBe(-3n);
    expect(roundDiv(4n, 3n)).toBe(1n);
  });

  it('classifies moves by location type', () => {
    expect(classifyStockMove('supplier', 'internal')).toBe('receipt');
    expect(classifyStockMove('internal', 'customer')).toBe('delivery');
    expect(classifyStockMove('customer', 'internal')).toBe('return');
    expect(classifyStockMove('internal', 'inventory_loss')).toBe('loss');
    expect(classifyStockMove('inventory_loss', 'internal')).toBe('gain');
    expect(classifyStockMove('internal', 'internal')).toBe('transfer');
    expect(classifyStockMove('customer', 'supplier')).toBeNull();
  });
});
