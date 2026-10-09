import { describe, expect, it } from 'vitest';
import { computeLine, computeTotals, paymentStateFor, parseQtyMilli, stampDutyCents } from '../service/math';

const c = (n: number) => BigInt(n);

describe('parseQtyMilli', () => {
  it('parses up to 3 decimals', () => {
    expect(parseQtyMilli('2')).toBe(c(2000));
    expect(parseQtyMilli('1.5')).toBe(c(1500));
    expect(parseQtyMilli('0.125')).toBe(c(125));
  });
  it('rejects zero, negatives, and extra precision', () => {
    expect(parseQtyMilli('0')).toBeNull();
    expect(parseQtyMilli('-1')).toBeNull();
    expect(parseQtyMilli('1.2345')).toBeNull();
    expect(parseQtyMilli('abc')).toBeNull();
  });
});

describe('computeLine', () => {
  it('rounds the subtotal and applies the rate to it', () => {
    // 3 x 333.33 DA = 999.99 DA; 19% = 189.9981 -> 190.00 DA (19000 + rounding)
    const r = computeLine({ quantity: '3', unitPriceCents: c(33333), ratePercent: '19' });
    expect(r.subtotalCents).toBe(c(99999));
    expect(r.taxCents).toBe(c(18999 + 1));
  });
  it('rounds half up on quantity fractions', () => {
    // 0.125 x 1 DA = 0.125 DA = 12.5 centimes -> 13
    const r = computeLine({ quantity: '0.125', unitPriceCents: c(100), ratePercent: '0' });
    expect(r.subtotalCents).toBe(c(13));
  });
});

describe('computeTotals', () => {
  it('sums lines and groups tax by rate', () => {
    const t = computeTotals([
      { quantity: '1', unitPriceCents: c(100000), ratePercent: '19' },
      { quantity: '2', unitPriceCents: c(50000), ratePercent: '9' },
      { quantity: '1', unitPriceCents: c(20000), ratePercent: '19.0000' },
    ]);
    expect(t.untaxedCents).toBe(c(220000));
    expect(t.taxCents).toBe(c(19000 + 9000 + 3800));
    expect(t.taxGroups.map((g) => g.ratePercent)).toEqual(['19', '9']);
    expect(t.taxGroups[0]?.baseCents).toBe(c(120000));
  });
});

describe('stampDutyCents', () => {
  it('uses the tier for the whole amount in DA', () => {
    expect(stampDutyCents(c(29999 * 100))).toBe(c(100));
    expect(stampDutyCents(c(30000 * 100))).toBe(c(150));
    expect(stampDutyCents(c(100000 * 100))).toBe(c(200));
  });
  it('is zero below 300 DA', () => {
    expect(stampDutyCents(c(299 * 100))).toBe(c(0));
  });
});

describe('paymentStateFor', () => {
  it('derives the state from paid vs total', () => {
    expect(paymentStateFor(c(0), c(100))).toBe('not_paid');
    expect(paymentStateFor(c(40), c(100))).toBe('partial');
    expect(paymentStateFor(c(100), c(100))).toBe('paid');
  });
});
