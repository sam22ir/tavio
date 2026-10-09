import { describe, expect, it } from 'vitest';
import { changeDue, expectedCash, lineAmounts, orderTotals, parseQuantityMilli } from '../service/totals';

describe('parseQuantityMilli', () => {
  it.each([
    ['2', BigInt(2000)],
    ['1.5', BigInt(1500)],
    ['0.250', BigInt(250)],
  ])('parses %s', (input, expected) => {
    expect(parseQuantityMilli(input)).toBe(expected);
  });

  it.each(['0', '0.000', '', '-1', '1.2345', 'abc', '1,5'])('rejects %s', (input) => {
    expect(parseQuantityMilli(input)).toBeNull();
  });
});

describe('lineAmounts', () => {
  it('computes subtotal and tax with half-up rounding to the centime', () => {
    // 1000 cents x 1 unit at 19% = 1190
    expect(lineAmounts({ unitPriceCents: BigInt(100000), quantityMilli: BigInt(1000), taxRate: '19' })).toEqual({
      subtotalCents: BigInt(100000),
      taxCents: BigInt(19000),
    });
  });

  it('rounds the subtotal of a fractional quantity half-up', () => {
    // 3 cents x 0.500 units = 1.5 cents -> 2 cents
    expect(lineAmounts({ unitPriceCents: BigInt(3), quantityMilli: BigInt(500), taxRate: '0' })).toEqual({
      subtotalCents: BigInt(2),
      taxCents: BigInt(0),
    });
  });

  it('handles zero-tax lines and zero price', () => {
    expect(lineAmounts({ unitPriceCents: BigInt(0), quantityMilli: BigInt(1000), taxRate: '19' })).toEqual({
      subtotalCents: BigInt(0),
      taxCents: BigInt(0),
    });
  });
});

describe('orderTotals', () => {
  it('sums lines and adds untaxed and tax into the total', () => {
    const totals = orderTotals([
      { subtotalCents: BigInt(1000), taxCents: BigInt(190) },
      { subtotalCents: BigInt(250), taxCents: BigInt(0) },
    ]);
    expect(totals).toEqual({ untaxedCents: BigInt(1250), taxCents: BigInt(190), totalCents: BigInt(1440) });
  });

  it('returns zeros for an empty order', () => {
    expect(orderTotals([])).toEqual({ untaxedCents: BigInt(0), taxCents: BigInt(0), totalCents: BigInt(0) });
  });
});

describe('expectedCash and changeDue', () => {
  it('expected cash is the opening float plus cash sales', () => {
    expect(expectedCash(BigInt(5000), BigInt(12000))).toBe(BigInt(17000));
  });

  it('change is tender minus total, and null when under-tendered', () => {
    expect(changeDue(BigInt(1440), BigInt(2000))).toBe(BigInt(560));
    expect(changeDue(BigInt(1440), BigInt(1440))).toBe(BigInt(0));
    expect(changeDue(BigInt(1440), BigInt(1439))).toBeNull();
  });
});
