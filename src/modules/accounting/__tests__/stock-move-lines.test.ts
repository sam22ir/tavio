import { describe, expect, it } from 'vitest';
import { checkBalanced } from '../service/posting';
import { INVENTORY_ACCOUNTS, stockMoveLines } from '../service/posting';

const summary = (lines: ReturnType<typeof stockMoveLines>) =>
  lines.map((l) => ({ code: l.accountCode, dr: l.debitCents, cr: l.creditCents }));

describe('stockMoveLines', () => {
  it('maps receipts to Dr 30 / Cr 380', () => {
    const lines = stockMoveLines({ kind: 'receipt', valueCents: 1000n, reference: 'R1' });
    expect(summary(lines)).toEqual([
      { code: '30', dr: 1000n, cr: 0n },
      { code: '380', dr: 0n, cr: 1000n },
    ]);
    expect(checkBalanced(lines).ok).toBe(true);
  });

  it('maps a delivery to Dr 600 / Cr 30 for 750', () => {
    const lines = stockMoveLines({ kind: 'delivery', valueCents: 750n, reference: 'D1' });
    expect(summary(lines)).toEqual([
      { code: '600', dr: 750n, cr: 0n },
      { code: '30', dr: 0n, cr: 750n },
    ]);
  });

  it('reverses the delivery for returns and gains, and mirrors it for losses', () => {
    expect(summary(stockMoveLines({ kind: 'return', valueCents: 5n, reference: 'X' }))[0]).toEqual({ code: '30', dr: 5n, cr: 0n });
    expect(summary(stockMoveLines({ kind: 'gain', valueCents: 5n, reference: 'X' }))[0]).toEqual({ code: '30', dr: 5n, cr: 0n });
    expect(summary(stockMoveLines({ kind: 'loss', valueCents: 5n, reference: 'X' }))[0]).toEqual({ code: '600', dr: 5n, cr: 0n });
  });

  it('produces no lines for transfers and zero values', () => {
    expect(stockMoveLines({ kind: 'transfer', valueCents: 100n, reference: 'T' })).toEqual([]);
    expect(stockMoveLines({ kind: 'receipt', valueCents: 0n, reference: 'R' })).toEqual([]);
  });

  it('uses the mapped accounts', () => {
    expect(INVENTORY_ACCOUNTS).toEqual({ stock: '30', stockedPurchases: '380', costOfGoodsSold: '600' });
  });
});
