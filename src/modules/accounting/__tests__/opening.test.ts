import { describe, expect, it } from 'vitest';
import { formatCents, openingDifference } from '../service/opening';
import { OPENING_STOCK_COUNTER_ACCOUNT, openingStockLines } from '../service/posting';

describe('opening balances', () => {
  it('a balanced set has zero difference', () => {
    const diff = openingDifference([
      { debitCents: BigInt(150000), creditCents: BigInt(0) },
      { debitCents: BigInt(0), creditCents: BigInt(150000) },
    ]);
    expect(diff).toBe(BigInt(0));
  });

  it('reports the signed difference when debits and credits differ', () => {
    const lines = [
      { debitCents: BigInt(150000), creditCents: BigInt(0) },
      { debitCents: BigInt(0), creditCents: BigInt(120050) },
    ];
    expect(openingDifference(lines)).toBe(BigInt(29950));
    expect(formatCents(openingDifference(lines))).toBe('299.50');
    expect(formatCents(BigInt(-1250))).toBe('-12.50');
    expect(formatCents(BigInt(0))).toBe('0.00');
  });
});

describe('opening stock journal lines', () => {
  it('books Dr 30 / Cr 101 flagged to verify', () => {
    const lines = openingStockLines({ valueCents: BigInt(15000), reference: 'MV2026/00001' });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ accountCode: '30', debitCents: BigInt(15000), creditCents: BigInt(0) });
    expect(lines[1]).toMatchObject({ accountCode: OPENING_STOCK_COUNTER_ACCOUNT, debitCents: BigInt(0), creditCents: BigInt(15000) });
    expect(lines[0]?.label).toContain('à vérifier');
  });

  it('a zero value produces no lines', () => {
    expect(openingStockLines({ valueCents: BigInt(0), reference: 'MV' })).toEqual([]);
  });
});
