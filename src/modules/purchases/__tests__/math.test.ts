import { describe, expect, it } from 'vitest';
import { formatQty, lineAmounts, parseQty, remainingQty, sumTotals } from '../service/math';

describe('parseQty', () => {
  it('parses whole and decimal quantities into thousandths', () => {
    expect(parseQty('2')).toBe(BigInt(2000));
    expect(parseQty('2.5')).toBe(BigInt(2500));
    expect(parseQty('0.125')).toBe(BigInt(125));
  });

  it('rejects zero, negatives, floats with extra decimals and junk', () => {
    expect(parseQty('0')).toBeNull();
    expect(parseQty('0.000')).toBeNull();
    expect(parseQty('-1')).toBeNull();
    expect(parseQty('1.2345')).toBeNull();
    expect(parseQty('abc')).toBeNull();
    expect(parseQty('')).toBeNull();
  });
});

describe('formatQty', () => {
  it('formats thousandths as numeric(14,3) text', () => {
    expect(formatQty(BigInt(2500))).toBe('2.500');
    expect(formatQty(BigInt(0))).toBe('0.000');
    expect(formatQty(BigInt(7))).toBe('0.007');
  });
});

describe('lineAmounts', () => {
  it('computes subtotal and tax with half-up rounding', () => {
    // 3 x 1000 DA at 19% TVA
    expect(lineAmounts({ quantity: '3', unitPriceCents: BigInt(100000), ratePercent: '19' })).toEqual({
      subtotalCents: BigInt(300000),
      taxCents: BigInt(57000),
    });
  });

  it('rounds fractional quantities half-up to the centime', () => {
    // 0.5 x 1 DA = 0.50 DA exactly; 0.125 x 1 DA = 0.125 DA rounds to 0.13 DA (13 cents)
    expect(lineAmounts({ quantity: '0.125', unitPriceCents: BigInt(100), ratePercent: null }).subtotalCents).toBe(
      BigInt(13),
    );
  });

  it('has no tax when no rate applies', () => {
    expect(lineAmounts({ quantity: '1', unitPriceCents: BigInt(500), ratePercent: null }).taxCents).toBe(BigInt(0));
  });

  it('throws on an invalid quantity', () => {
    expect(() => lineAmounts({ quantity: '0', unitPriceCents: BigInt(1), ratePercent: null })).toThrow(RangeError);
  });
});

describe('sumTotals', () => {
  it('sums untaxed, tax and total', () => {
    const totals = sumTotals([
      { subtotalCents: BigInt(1000), taxCents: BigInt(190) },
      { subtotalCents: BigInt(500), taxCents: BigInt(0) },
    ]);
    expect(totals).toEqual({ untaxedCents: BigInt(1500), taxCents: BigInt(190), totalCents: BigInt(1690) });
  });

  it('is zero for no lines', () => {
    expect(sumTotals([])).toEqual({ untaxedCents: BigInt(0), taxCents: BigInt(0), totalCents: BigInt(0) });
  });
});

describe('remainingQty', () => {
  it('returns ordered minus received', () => {
    expect(remainingQty('5.000', '2.000')).toBe(BigInt(3000));
  });

  it('never goes negative', () => {
    expect(remainingQty('1.000', '4.000')).toBe(BigInt(0));
  });
});
