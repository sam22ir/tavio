import { describe, expect, it } from 'vitest';
import { g50Summary, periodBounds } from '../service/g50';

const C = (n: number) => BigInt(n);

describe('G50 period and summary', () => {
  it('period bounds cover the whole month, including leap years', () => {
    expect(periodBounds(2026, 2)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(periodBounds(2028, 2)).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(periodBounds(2026, 12)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('net due is collected minus deductible, timbre is reported apart, and it is marked for review', () => {
    expect(g50Summary(C(19000), C(4500), C(100))).toEqual({
      collectedCents: C(19000),
      deductibleCents: C(4500),
      netDueCents: C(14500),
      stampCents: C(100),
      needsAccountantReview: true,
    });
  });

  it('can return a credit position', () => {
    expect(g50Summary(C(100), C(300)).netDueCents).toBe(C(-200));
  });
});
