import { describe, expect, it } from 'vitest';
import {
  checkCloseable,
  findSubsetMatch,
  isStatementAccountCode,
  parseBankAmount,
  parseBankDate,
  parseBankRows,
  rankProposals,
  referenceMatches,
  runningGap,
  scoreSingle,
  type EntryCandidate,
  type MatchLineInput,
} from '../service/reconciliation';

const c = (id: string, value: bigint, date: string, number: string, extra: Partial<EntryCandidate> = {}): EntryCandidate => ({
  journalLineId: id,
  date,
  valueCents: value,
  entryNumber: number,
  entryRef: null,
  lineLabel: null,
  ...extra,
});

describe('parseBankDate', () => {
  it.each([
    ['05/03/2026', '2026-03-05'],
    ['5/3/2026', '2026-03-05'],
    ['05.03.2026', '2026-03-05'],
    ['05-03-26', '2026-03-05'],
    ['2026-03-05', '2026-03-05'],
    [' 29/02/2028 ', '2028-02-29'],
  ])('reads %s as %s', (input, expected) => {
    expect(parseBankDate(input)).toBe(expected);
  });

  it.each(['31/02/2026', '03/13/2026', '2026/03/05', '', 'hier', '00/01/2026'])('rejects %s', (input) => {
    expect(parseBankDate(input)).toBeNull();
  });
});

describe('parseBankAmount', () => {
  it.each([
    ['1500', 150000n],
    ['1500,5', 150050n],
    ['1 234,50', 123450n],
    ['1 234,50', 123450n],
    ['1.234,50', 123450n],
    ['1,234.50', 123450n],
    ['1,234,567', 123456700n],
    ['1234.5', 123450n],
    ['-12,00', -1200n],
    ['(12,00)', -1200n],
    ['12,00-', -1200n],
    ['12,00 DA', 1200n],
    ['0,07', 7n],
  ])('reads %s as %s cents', (input, expected) => {
    expect(parseBankAmount(input)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '12,345', '--5'])('rejects %s', (input) => {
    expect(parseBankAmount(input)).toBeNull();
  });
});

describe('parseBankRows', () => {
  const records = [
    ['Date', 'Libellé', 'Référence', 'Débit', 'Crédit'],
    ['05/03/2026', 'Virement client', 'FAC/2026/00004', '', '25 000,00'],
    ['06/03/2026', 'Frais tenue de compte', '', '1 200,00', ''],
    ['', '', '', '', ''],
    ['32/03/2026', 'Date fausse', '', '1,00', ''],
    ['07/03/2026', 'Montant fou', '', 'x', ''],
  ];
  const mapping = { date: 0, label: 1, reference: 2, debit: 3, credit: 4, amount: null };

  it('signs debit and credit as money out and money in', () => {
    const { lines, errors } = parseBankRows(records, mapping);
    expect(lines).toEqual([
      { date: '2026-03-05', label: 'Virement client', reference: 'FAC/2026/00004', amountCents: 2500000n },
      { date: '2026-03-06', label: 'Frais tenue de compte', reference: null, amountCents: -120000n },
    ]);
    expect(errors).toEqual([
      { row: 5, message: 'INVALID_DATE' },
      { row: 6, message: 'INVALID_AMOUNT' },
    ]);
  });

  it('reads a single signed amount column', () => {
    const { lines } = parseBankRows(
      [['date', 'label', 'montant'], ['01/04/2026', 'Agios', '-350,25']],
      { date: 0, label: 1, reference: null, debit: null, credit: null, amount: 2 },
    );
    expect(lines[0]?.amountCents).toBe(-35025n);
  });
});

describe('scoring and ranking', () => {
  const line: MatchLineInput = { date: '2026-03-10', label: 'VIR CLIENT FAC/2026/00004', reference: null, amountCents: 500000n };

  it('requires the same amount', () => {
    expect(scoreSingle(line, c('a', 400000n, '2026-03-10', 'VT/2026/00001'))).toBeNull();
  });

  it('adds reference and date points on top of the amount', () => {
    const exact = scoreSingle(line, c('a', 500000n, '2026-03-10', 'VT/2026/00004', { entryRef: 'FAC/2026/00004' }));
    expect(exact).toEqual({ score: 60 + 25 + 15, reasons: ['amount', 'reference', 'date'] });
    const plain = scoreSingle(line, c('b', 500000n, '2026-03-30', 'VT/2026/00009'));
    expect(plain).toEqual({ score: 60, reasons: ['amount'] });
  });

  it('gives date points inside the ±7 day window only, decreasing with distance', () => {
    const d3 = scoreSingle(line, c('a', 500000n, '2026-03-13', 'X'));
    const d6 = scoreSingle(line, c('a', 500000n, '2026-03-04', 'X'));
    expect(d3?.score).toBe(60 + Math.round((15 * 4) / 7));
    expect(d6?.score).toBe(60 + Math.round(15 / 7));
    expect(d6?.reasons).toContain('date');
    const d8 = scoreSingle(line, c('a', 500000n, '2026-03-02', 'X'));
    expect(d8?.reasons).not.toContain('date');
  });

  it('matches references in either direction and ignores short keys', () => {
    expect(referenceMatches({ ...line, label: 'VIR VT/2026-00012' }, c('a', 0n, '2026-03-10', 'VT/2026-00012'))).toBe(true);
    expect(referenceMatches({ ...line, label: 'X' }, c('a', 0n, '2026-03-10', 'VT/2026-00012'))).toBe(false);
    expect(referenceMatches({ ...line, reference: 'REF-778' }, c('a', 0n, '2026-03-10', 'VT/778'))).toBe(false);
  });

  it('ranks by amount, then reference, then date, and caps the list', () => {
    const cands = [
      c('far', 500000n, '2026-03-30', 'AAA'),
      c('ref', 500000n, '2026-03-25', 'FAC/2026/00004'),
      c('near', 500000n, '2026-03-10', 'BBB'),
      c('wrongAmount', 499000n, '2026-03-10', 'CCC'),
    ];
    const ranked = rankProposals({ ...line, label: 'VIR FAC/2026/00004' }, cands);
    expect(ranked.map((p) => p.journalLineIds[0])).toEqual(['ref', 'near', 'far']);
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]!.score);
    expect(rankProposals({ ...line, label: 'x' }, cands, 2)).toHaveLength(2);
  });

  it('breaks ties by date proximity then id, so the order is stable', () => {
    const cands = [c('z', 500000n, '2026-03-12', 'A'), c('y', 500000n, '2026-03-08', 'B')];
    const ranked = rankProposals(line, cands);
    expect(ranked[0]?.journalLineIds).toEqual(['y']);
  });
});

describe('multi-line sum match', () => {
  it('finds two entry lines that sum to the statement amount', () => {
    const pool = [
      { id: 'a', cents: 300000n },
      { id: 'b', cents: 150000n },
      { id: 'c', cents: 200000n },
    ];
    expect(findSubsetMatch(pool, 450000n)).toEqual(['a', 'b']);
  });

  it('returns null when no set of up to four lines sums to the target', () => {
    expect(findSubsetMatch([{ id: 'a', cents: 100n }, { id: 'b', cents: 200n }], 400n)).toBeNull();
  });

  it('proposes a group when no single line matches the amount', () => {
    const line: MatchLineInput = { date: '2026-03-10', label: 'VIR', reference: null, amountCents: 300000n };
    const ranked = rankProposals(line, [c('a', 100000n, '2026-03-10', 'A'), c('b', 200000n, '2026-03-09', 'B')]);
    expect(ranked).toEqual([{ kind: 'group', journalLineIds: ['a', 'b'], score: 40, reasons: ['sum'] }]);
  });
});

describe('close rule and running difference', () => {
  const lines = [
    { amountCents: 100000n, state: 'matched' as const },
    { amountCents: -2500n, state: 'ignored' as const },
  ];

  it('closes when every line is matched or ignored and the balance ties', () => {
    const res = checkCloseable(1000000n, 1097500n, lines);
    expect(res).toEqual({ ok: true, value: { sumCents: 97500n } });
  });

  it('refuses while a line is unmatched', () => {
    const res = checkCloseable(0n, 97500n, [...lines, { amountCents: 1n, state: 'unmatched' }]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('CONFLICT');
  });

  it('refuses when the closing balance does not equal opening plus the lines', () => {
    const res = checkCloseable(1000000n, 1100000n, lines);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.details).toEqual({ messageKey: 'reconciliation.errors.balanceMismatch' });
  });

  it('measures what is still unaccounted for', () => {
    expect(runningGap(1000000n, 1097500n, lines)).toBe(0n);
    expect(runningGap(1000000n, 1097500n, [{ amountCents: 100000n, state: 'matched' }, { amountCents: -2500n, state: 'unmatched' }])).toBe(-2500n);
  });
});

describe('statement accounts', () => {
  it.each([['512', true], ['5121', true], ['512001', true], ['53', true], ['51', false], ['530', false], ['411', false]])(
    'accepts %s: %s',
    (code, expected) => {
      expect(isStatementAccountCode(code)).toBe(expected);
    },
  );
});
