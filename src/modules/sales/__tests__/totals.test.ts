import { describe, expect, it } from 'vitest';
import { computeOrderTotals, lineSubtotal, parseDiscountRate, parseQuantity } from '../service/totals';

describe('parseQuantity', () => {
  it('parses integers and up to 3 decimals', () => {
    expect(parseQuantity('2')).toBe(BigInt(2000));
    expect(parseQuantity('2.5')).toBe(BigInt(2500));
    expect(parseQuantity('0.125')).toBe(BigInt(125));
  });
  it('rejects zero, negatives, too many decimals and garbage', () => {
    expect(parseQuantity('0')).toBeNull();
    expect(parseQuantity('-1')).toBeNull();
    expect(parseQuantity('1.1234')).toBeNull();
    expect(parseQuantity('abc')).toBeNull();
    expect(parseQuantity('')).toBeNull();
  });
});

describe('parseDiscountRate', () => {
  it('treats empty as zero and accepts 0 to 100', () => {
    expect(parseDiscountRate('')).toBe(BigInt(0));
    expect(parseDiscountRate('10')).toBe(BigInt(100000));
    expect(parseDiscountRate('100')).toBe(BigInt(1000000));
  });
  it('rejects values above 100 or negative', () => {
    expect(parseDiscountRate('100.0001')).toBeNull();
    expect(parseDiscountRate('-5')).toBeNull();
  });
});

describe('lineSubtotal', () => {
  it('multiplies quantity by unit price', () => {
    expect(lineSubtotal(BigInt(3000), BigInt(150000), BigInt(0))).toBe(BigInt(450000));
  });
  it('applies a percent discount', () => {
    // 2 x 1000.00 DZD with 10% off = 1800.00 DZD = 180000 cents
    expect(lineSubtotal(BigInt(2000), BigInt(100000), BigInt(100000))).toBe(BigInt(180000));
  });
  it('rounds half-up to the centime', () => {
    // 0.5 x 1 cent = 0.5 cent rounds to 1 cent
    expect(lineSubtotal(BigInt(500), BigInt(1), BigInt(0))).toBe(BigInt(1));
    // 0.5 x 1 cent with 0 discount is 0.5 -> 1 ; with 100% discount it is 0
    expect(lineSubtotal(BigInt(500), BigInt(1), BigInt(1000000))).toBe(BigInt(0));
  });
  it('handles zero price and the largest supported value', () => {
    expect(lineSubtotal(BigInt(1000), BigInt(0), BigInt(0))).toBe(BigInt(0));
    const big = BigInt('9999999999999999');
    expect(lineSubtotal(BigInt(1000), big, BigInt(0))).toBe(big);
  });
});

describe('computeOrderTotals', () => {
  it('computes line VAT with applyRate and sums the order', () => {
    const totals = computeOrderTotals([
      { quantity: '1', unitPriceCents: BigInt(100000), discountRate: '0', taxRate: '19.0000' },
      { quantity: '2', unitPriceCents: BigInt(50000), discountRate: '0', taxRate: '9.0000' },
      { quantity: '1', unitPriceCents: BigInt(20000), discountRate: '0', taxRate: null },
    ]);
    expect(totals.untaxedCents).toBe(BigInt(220000));
    // 19% of 100000 = 19000; 9% of 100000 = 9000
    expect(totals.taxCents).toBe(BigInt(28000));
    expect(totals.totalCents).toBe(BigInt(248000));
    expect(totals.lines.map((l) => l.taxCents)).toEqual([BigInt(19000), BigInt(9000), BigInt(0)]);
  });
  it('returns zeros for an empty order', () => {
    const totals = computeOrderTotals([]);
    expect(totals.totalCents).toBe(BigInt(0));
  });
  it('rejects invalid lines', () => {
    expect(() =>
      computeOrderTotals([{ quantity: '0', unitPriceCents: BigInt(1), discountRate: '0', taxRate: null }]),
    ).toThrow(RangeError);
    expect(() =>
      computeOrderTotals([{ quantity: '1', unitPriceCents: BigInt(-1), discountRate: '0', taxRate: null }]),
    ).toThrow(RangeError);
  });
});
