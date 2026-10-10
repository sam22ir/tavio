import { describe, expect, it } from 'vitest';
import { computeOrderTotals } from '@/modules/sales/service/totals';
import { computeLine, computeTotals, formatPercent, hasLineDiscount, paymentStateFor, parseQtyMilli, stampDutyCents } from '../service/math';

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

describe('computeLine with line discount', () => {
  it('0% discount leaves the subtotal unchanged', () => {
    // 3 x 333.33 DA = 999.99 DA, no discount
    const r = computeLine({ quantity: '3', unitPriceCents: c(33333), ratePercent: '19', discountRate: '0' });
    expect(r.subtotalCents).toBe(c(99999));
    expect(r.taxCents).toBe(c(19000));
  });
  it('5% discount applies before VAT, rounded to the centime', () => {
    // 999.99 DA x 0.95 = 949.9905 DA -> 94999 centimes; VAT 19% of 94999 = 18049.81 -> 18050
    const r = computeLine({ quantity: '3', unitPriceCents: c(33333), ratePercent: '19', discountRate: '5' });
    expect(r.subtotalCents).toBe(c(94999));
    expect(r.taxCents).toBe(c(18050));
  });
  it('12.5% discount on a 10.01 DA unit price', () => {
    // 10.01 DA x 0.875 = 8.75875 DA -> 876 centimes; no VAT
    const r = computeLine({ quantity: '1', unitPriceCents: c(1001), ratePercent: '0', discountRate: '12.5' });
    expect(r.subtotalCents).toBe(c(876));
    expect(r.taxCents).toBe(c(0));
  });
  it('rounds exact half centimes up', () => {
    // 4 centimes x 87.5% = 3.5 centimes -> 4
    const half = computeLine({ quantity: '1', unitPriceCents: c(4), ratePercent: '0', discountRate: '12.5' });
    expect(half.subtotalCents).toBe(c(4));
    // 10 centimes x 95% = 9.5 centimes -> 10
    const half2 = computeLine({ quantity: '1', unitPriceCents: c(10), ratePercent: '0', discountRate: '5' });
    expect(half2.subtotalCents).toBe(c(10));
  });
  it('rejects a discount above 100% or malformed', () => {
    expect(() => computeLine({ quantity: '1', unitPriceCents: c(100), ratePercent: '0', discountRate: '101' })).toThrow(RangeError);
    expect(() => computeLine({ quantity: '1', unitPriceCents: c(100), ratePercent: '0', discountRate: 'abc' })).toThrow(RangeError);
  });
  it('helpers: hasLineDiscount and formatPercent', () => {
    expect(hasLineDiscount('0')).toBe(false);
    expect(hasLineDiscount('0.0000')).toBe(false);
    expect(hasLineDiscount('12.5000')).toBe(true);
    expect(formatPercent('10.0000')).toBe('10');
    expect(formatPercent('12.5000')).toBe('12.5');
  });
  it('quote and invoice with a 10% line discount have identical untaxed, VAT and total', () => {
    const quote = computeOrderTotals([{ quantity: '3', unitPriceCents: c(33333), discountRate: '10', taxRate: '19.0000' }]);
    const invoice = computeTotals([{ quantity: '3', unitPriceCents: c(33333), ratePercent: '19', discountRate: '10' }]);
    // 999.99 DA x 0.90 = 899.991 DA -> 89999 centimes; VAT 19% = 17099.81 -> 17100
    expect(quote.untaxedCents).toBe(c(89999));
    expect(quote.taxCents).toBe(c(17100));
    expect(invoice.untaxedCents).toBe(quote.untaxedCents);
    expect(invoice.taxCents).toBe(quote.taxCents);
    expect(invoice.untaxedCents + invoice.taxCents).toBe(quote.totalCents);
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
  it('places each boundary amount in the tier that starts there', () => {
    // Tiers are [min, max): 300 DA starts the 1 DA tier, 30 000 DA starts the 1.5 DA tier, 100 000 DA starts the 2 DA tier.
    expect(stampDutyCents(c(300 * 100))).toBe(c(100));
    expect(stampDutyCents(c(300 * 100 - 1))).toBe(c(0));
    expect(stampDutyCents(c(30000 * 100 - 1))).toBe(c(100));
    expect(stampDutyCents(c(30000 * 100))).toBe(c(150));
    expect(stampDutyCents(c(100000 * 100 - 1))).toBe(c(150));
    expect(stampDutyCents(c(100000 * 100))).toBe(c(200));
  });
  it('drops centimes when choosing the tier', () => {
    // 299.99 DA is still in the zero tier, 300.00 DA is the first taxed amount.
    expect(stampDutyCents(c(29999))).toBe(c(0));
    expect(stampDutyCents(c(30000))).toBe(c(100));
  });
});

describe('paymentStateFor', () => {
  it('derives the state from paid vs total', () => {
    expect(paymentStateFor(c(0), c(100))).toBe('not_paid');
    expect(paymentStateFor(c(40), c(100))).toBe('partial');
    expect(paymentStateFor(c(100), c(100))).toBe('paid');
  });
});

describe('computeTotals with several lines', () => {
  it('sums untaxed and tax across mixed rates and rounds each line half-up', () => {
    const t = computeTotals([
      { quantity: '2', unitPriceCents: c(10000), ratePercent: '19' },
      { quantity: '1.5', unitPriceCents: c(5001), ratePercent: '0' },
      { quantity: '1', unitPriceCents: c(1000), ratePercent: '9' },
    ]);
    expect(t.lines.map((l) => l.subtotalCents)).toEqual([c(20000), c(7502), c(1000)]);
    expect(t.untaxedCents).toBe(c(28502));
    expect(t.taxCents).toBe(c(3890));
    expect(t.taxGroups.map((g) => [g.ratePercent, g.baseCents, g.taxCents])).toEqual([
      ['19', c(20000), c(3800)],
      ['0', c(7502), c(0)],
      ['9', c(1000), c(90)],
    ]);
  });

  it('returns zero totals for an empty list and rejects an invalid line anywhere in the list', () => {
    expect(computeTotals([]).untaxedCents).toBe(c(0));
    expect(() =>
      computeTotals([
        { quantity: '1', unitPriceCents: c(100), ratePercent: '19' },
        { quantity: '0', unitPriceCents: c(100), ratePercent: '19' },
      ]),
    ).toThrow(RangeError);
  });
});
