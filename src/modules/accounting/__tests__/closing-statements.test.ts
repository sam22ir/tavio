import { describe, expect, it } from 'vitest';
import { applyLines, buildOpeningLines, buildResultLines, imbalance, type Balance } from '../service/closing';
import { agePartnerItems, buildBilan, buildTcr, matchPrefix, SCF_BILAN_MAP, type AccountNet } from '../service/statements';

const c = (n: number) => BigInt(n);

// Fixture: capital 1000, sale 1000 + VAT 190 on credit, purchase 400 on credit, customer pays 500 by bank.
const FIXTURE: Balance[] = [
  { code: '512', debitCents: c(1500), creditCents: c(0) },
  { code: '101', debitCents: c(0), creditCents: c(1000) },
  { code: '411', debitCents: c(690), creditCents: c(0) },
  { code: '700', debitCents: c(0), creditCents: c(1000) },
  { code: '4457', debitCents: c(0), creditCents: c(190) },
  { code: '600', debitCents: c(400), creditCents: c(0) },
  { code: '401', debitCents: c(0), creditCents: c(400) },
];

const nets = (rows: Balance[], typeOf: (code: string) => AccountNet['type']): AccountNet[] =>
  rows.map((r) => ({ code: r.code, type: typeOf(r.code), netCents: r.debitCents - r.creditCents }));

const typeOf = (code: string): AccountNet['type'] => {
  if (code.startsWith('7')) return 'income';
  if (code.startsWith('6')) return 'expense';
  if (code.startsWith('1')) return 'equity';
  if (code.startsWith('4') && ['401', '4457'].includes(code)) return 'liability';
  return 'asset';
};

describe('closing math', () => {
  it('result entry closes classes 6 and 7 into 12 and balances', () => {
    const lines = buildResultLines(FIXTURE);
    expect(imbalance(lines)).toBe(c(0));
    const r12 = lines.find((l) => l.accountCode === '12');
    expect(r12?.creditCents).toBe(c(600));
    expect(lines.filter((l) => l.accountCode.startsWith('7') || l.accountCode.startsWith('6')).length).toBe(2);
  });

  it('closing balances of classes 6 and 7 are zero after the result entry', () => {
    const after = applyLines(FIXTURE, buildResultLines(FIXTURE));
    for (const b of after.filter((x) => x.code.startsWith('6') || x.code.startsWith('7'))) {
      expect(b.debitCents - b.creditCents).toBe(c(0));
    }
  });

  it('opening entry carries the classes 1 to 5 closing balances and balances itself', () => {
    const after = applyLines(FIXTURE, buildResultLines(FIXTURE));
    const opening = buildOpeningLines(after);
    expect(imbalance(opening)).toBe(c(0));
    for (const b of after.filter((x) => Number(x.code[0]) <= 5)) {
      const net = b.debitCents - b.creditCents;
      const line = opening.find((l) => l.accountCode === b.code);
      const openNet = line ? line.debitCents - line.creditCents : c(0);
      expect(openNet).toBe(net);
    }
  });

  it('a year with no class 6 or 7 movements produces no result entry', () => {
    expect(buildResultLines([{ code: '512', debitCents: c(10), creditCents: c(0) }, { code: '101', debitCents: c(0), creditCents: c(10) }])).toEqual([]);
  });
});

describe('bilan and TCR', () => {
  it('bilan actif equals passif on the fixture', () => {
    const bilan = buildBilan(nets(FIXTURE, typeOf));
    expect(bilan.totalActifCents).toBe(c(2190));
    expect(bilan.totalPassifCents).toBe(c(2190));
    expect(bilan.balanced).toBe(true);
  });

  it('TCR result equals the profit of the fixture', () => {
    const tcr = buildTcr(nets(FIXTURE, typeOf));
    expect(tcr.resultCents).toBe(c(600));
  });

  it('longest prefix wins in the bilan mapping', () => {
    expect(matchPrefix('4456', SCF_BILAN_MAP)).toBe('ACT_CREANCES');
    expect(matchPrefix('4457', SCF_BILAN_MAP)).toBe('PAS_FISC');
    expect(matchPrefix('380', SCF_BILAN_MAP)).toBe('PAS_FOURN');
  });
});

describe('partner aging', () => {
  const asOf = '2026-06-30';
  it('places open debits in the 0-30, 31-60, 61-90 and 90+ buckets', () => {
    const res = agePartnerItems(
      [
        { date: '2026-06-20', debitCents: c(100), creditCents: c(0) },
        { date: '2026-05-20', debitCents: c(200), creditCents: c(0) },
        { date: '2026-04-15', debitCents: c(300), creditCents: c(0) },
        { date: '2026-01-01', debitCents: c(400), creditCents: c(0) },
      ],
      asOf,
    );
    expect(res.buckets['0-30']).toBe(c(100));
    expect(res.buckets['31-60']).toBe(c(200));
    expect(res.buckets['61-90']).toBe(c(300));
    expect(res.buckets['90+']).toBe(c(400));
    expect(res.totalCents).toBe(c(1000));
  });

  it('credits settle the oldest debits first (FIFO)', () => {
    const res = agePartnerItems(
      [
        { date: '2026-01-01', debitCents: c(500), creditCents: c(0) },
        { date: '2026-06-25', debitCents: c(300), creditCents: c(0) },
        { date: '2026-06-28', debitCents: c(0), creditCents: c(600) },
      ],
      asOf,
    );
    expect(res.buckets['90+']).toBe(c(0));
    expect(res.buckets['0-30']).toBe(c(200));
    expect(res.totalCents).toBe(c(200));
    expect(res.unallocatedCents).toBe(c(0));
  });

  it('an advance beyond the open debits is reported as unallocated', () => {
    const res = agePartnerItems([{ date: '2026-06-01', debitCents: c(100), creditCents: c(250) }], asOf);
    expect(res.totalCents).toBe(c(0));
    expect(res.unallocatedCents).toBe(c(150));
  });
});
