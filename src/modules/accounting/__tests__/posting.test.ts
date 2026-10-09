import { describe, expect, it } from 'vitest';
import { SCF_CHART_SEED, JOURNAL_SEED } from '../service/chart';
import {
  checkBalanced,
  g50Summary,
  invertLines,
  invoiceLines,
  paymentLines,
  posLines,
  treasuryAccount,
  type DraftLine,
} from '../service/posting';

const C = (n: number) => BigInt(n);
const sum = (lines: DraftLine[], side: 'debitCents' | 'creditCents') =>
  lines.reduce((s, l) => s + l[side], C(0));

describe('checkBalanced', () => {
  it('accepts a balanced entry and returns the total', () => {
    const r = checkBalanced([
      { accountCode: '411', debitCents: C(1190), creditCents: C(0) },
      { accountCode: '700', debitCents: C(0), creditCents: C(1000) },
      { accountCode: '4457', debitCents: C(0), creditCents: C(190) },
    ]);
    expect(r).toEqual({ ok: true, value: { totalCents: C(1190) } });
  });

  it('rejects an unbalanced entry', () => {
    const r = checkBalanced([
      { accountCode: '411', debitCents: C(100), creditCents: C(0) },
      { accountCode: '700', debitCents: C(0), creditCents: C(99) },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toBe('ENTRY_NOT_BALANCED');
  });

  it('rejects a line with both sides or neither side', () => {
    const both = checkBalanced([
      { accountCode: '411', debitCents: C(5), creditCents: C(5) },
      { accountCode: '700', debitCents: C(0), creditCents: C(0) },
    ]);
    expect(both.ok).toBe(false);
    if (!both.ok) expect(both.error.message).toBe('LINE_NEEDS_ONE_SIDE');
  });

  it('rejects fewer than two lines and negative amounts', () => {
    expect(checkBalanced([{ accountCode: '411', debitCents: C(1), creditCents: C(0) }]).ok).toBe(false);
    const neg = checkBalanced([
      { accountCode: '411', debitCents: C(-1), creditCents: C(0) },
      { accountCode: '700', debitCents: C(0), creditCents: C(-1) },
    ]);
    expect(neg.ok).toBe(false);
  });
});

describe('invertLines', () => {
  it('swaps debit and credit and stays balanced', () => {
    const lines: DraftLine[] = [
      { accountCode: '411', debitCents: C(300), creditCents: C(0) },
      { accountCode: '700', debitCents: C(0), creditCents: C(300) },
    ];
    const inv = invertLines(lines);
    expect(inv[0]).toMatchObject({ accountCode: '411', debitCents: C(0), creditCents: C(300) });
    expect(checkBalanced(inv).ok).toBe(true);
  });
});

describe('invoiceLines', () => {
  const base = {
    partnerId: 'p1',
    number: 'FAC-1',
    untaxedCents: C(10000),
    taxCents: C(1900),
    stampCents: C(0),
    totalCents: C(11900),
  };

  it('posts a sale to 411 / 700 / 4457 and balances', () => {
    const lines = invoiceLines({ ...base, type: 'out_invoice' });
    expect(lines.map((l) => l.accountCode)).toEqual(['411', '700', '4457']);
    expect(sum(lines, 'debitCents')).toBe(sum(lines, 'creditCents'));
    expect(lines[0]).toMatchObject({ debitCents: C(11900), partnerId: 'p1' });
  });

  it('posts a purchase to 401 / 600 / 4456 and balances', () => {
    const lines = invoiceLines({ ...base, type: 'in_invoice' });
    expect(lines.map((l) => l.accountCode)).toEqual(['401', '600', '4456']);
    expect(lines[0]).toMatchObject({ creditCents: C(11900) });
    expect(sum(lines, 'debitCents')).toBe(sum(lines, 'creditCents'));
  });

  it('inverts every line for refunds', () => {
    const sale = invoiceLines({ ...base, type: 'out_invoice' });
    const refund = invoiceLines({ ...base, type: 'out_refund' });
    expect(refund).toEqual(invertLines(sale));
  });

  it('posts stamp duty on 445 and keeps the entry balanced', () => {
    const lines = invoiceLines({ ...base, stampCents: C(100), totalCents: C(12000), type: 'out_invoice' });
    expect(lines.find((l) => l.accountCode === '445')).toMatchObject({ creditCents: C(100) });
    expect(sum(lines, 'debitCents')).toBe(sum(lines, 'creditCents'));
  });
});

describe('paymentLines', () => {
  const p = { partnerId: 'p1', amountCents: C(500), reference: 'FAC-1' };

  it('receipt from a customer: Dr 512 / Cr 411', () => {
    const lines = paymentLines({ ...p, type: 'out_invoice', method: 'transfer' });
    expect(lines).toMatchObject([
      { accountCode: '512', debitCents: C(500), creditCents: C(0) },
      { accountCode: '411', debitCents: C(0), creditCents: C(500), partnerId: 'p1' },
    ]);
  });

  it('cash receipt goes to 53', () => {
    const lines = paymentLines({ ...p, type: 'out_invoice', method: 'cash' });
    expect(lines[0]?.accountCode).toBe('53');
  });

  it('supplier payment: Dr 401 / Cr 512, and a customer refund: Dr 411 / Cr 512', () => {
    const supplier = paymentLines({ ...p, type: 'in_invoice', method: 'transfer' });
    expect(supplier).toMatchObject([
      { accountCode: '512', creditCents: C(500) },
      { accountCode: '401', debitCents: C(500) },
    ]);
    const refund = paymentLines({ ...p, type: 'out_refund', method: 'transfer' });
    expect(refund).toMatchObject([
      { accountCode: '512', creditCents: C(500) },
      { accountCode: '411', debitCents: C(500) },
    ]);
  });

  it('every payment direction balances', () => {
    for (const type of ['out_invoice', 'out_refund', 'in_invoice', 'in_refund'] as const) {
      const lines = paymentLines({ ...p, type, method: 'cash' });
      expect(sum(lines, 'debitCents')).toBe(sum(lines, 'creditCents'));
    }
  });

  it('treasuryAccount maps cash to 53 and anything else to 512', () => {
    expect(treasuryAccount('cash')).toBe('53');
    expect(treasuryAccount('cheque')).toBe('512');
  });
});

describe('posLines', () => {
  it('posts cash to Dr 53 / Cr 700 / Cr 4457 and balances', () => {
    const lines = posLines({ orderId: 'o1', number: 'POS-1', method: 'cash', totalCents: C(1190), untaxedCents: C(1000), taxCents: C(190) });
    expect(lines.map((l) => [l.accountCode, l.debitCents > C(0) ? 'D' : 'C'])).toEqual([
      ['53', 'D'],
      ['700', 'C'],
      ['4457', 'C'],
    ]);
    expect(checkBalanced(lines).ok).toBe(true);
  });

  it.each(['cib', 'edahabia'])('posts %s card sales to the bank account 512', (method) => {
    const lines = posLines({ orderId: 'o1', number: 'POS-1', method, totalCents: C(1190), untaxedCents: C(1000), taxCents: C(190) });
    expect(lines.map((l) => [l.accountCode, l.debitCents > C(0) ? 'D' : 'C'])).toEqual([
      ['512', 'D'],
      ['700', 'C'],
      ['4457', 'C'],
    ]);
    expect(checkBalanced(lines).ok).toBe(true);
  });
});

describe('g50Summary', () => {
  it('nets collected minus deductible and is always marked for review', () => {
    expect(g50Summary(C(19000), C(4500))).toEqual({
      collectedCents: C(19000),
      deductibleCents: C(4500),
      netDueCents: C(14500),
      needsAccountantReview: true,
    });
  });

  it('can return a credit position', () => {
    expect(g50Summary(C(100), C(300)).netDueCents).toBe(C(-200));
  });
});

describe('seeds', () => {
  it('chart carries every account the posting rules use, each flagged for verification', () => {
    const codes = SCF_CHART_SEED.map((a) => a.code);
    for (const code of ['411', '401', '4457', '4456', '700', '600', '512', '53', '445']) {
      expect(codes).toContain(code);
    }
    expect(SCF_CHART_SEED.every((a) => a.verify.startsWith('⚠'))).toBe(true);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('journals cover the codes used by event handlers', () => {
    const codes = JOURNAL_SEED.map((j) => j.code);
    for (const code of ['VT', 'AC', 'CA', 'BQ']) expect(codes).toContain(code);
  });
});
