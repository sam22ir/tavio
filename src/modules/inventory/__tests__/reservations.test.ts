import { describe, expect, it } from 'vitest';
import { aggregateLines } from '../service/reservations';

describe('aggregateLines', () => {
  it('sums repeated products in thousandths', () => {
    const totals = aggregateLines([
      { productId: 'p1', quantity: '1.5' },
      { productId: 'p1', quantity: '2' },
      { productId: 'p2', quantity: '0.001' },
    ]);
    expect(totals.get('p1')).toBe(3500n);
    expect(totals.get('p2')).toBe(1n);
  });

  it('skips free-text lines, zero, negative and malformed quantities', () => {
    const totals = aggregateLines([
      { productId: null, quantity: '5' },
      { productId: 'p1', quantity: '0' },
      { productId: 'p1', quantity: '-2' },
      { productId: 'p1', quantity: 'abc' },
      { productId: 'p1', quantity: '1.2345' },
    ]);
    expect(totals.size).toBe(0);
  });

  it('returns an empty map for no lines', () => {
    expect(aggregateLines([]).size).toBe(0);
  });
});
