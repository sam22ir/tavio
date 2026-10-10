import { sumCents, type Cents } from '@/core/money';

export interface VatLine {
  ratePercent: string;
  baseCents: Cents;
  taxCents: Cents;
}

export interface VatGroup {
  ratePercent: string;
  baseCents: Cents;
  taxCents: Cents;
}

/** Groups document lines by VAT rate, sorted by ascending rate. Pure. */
export function groupVatByRate(lines: readonly VatLine[]): VatGroup[] {
  const byRate = new Map<string, { baseCents: Cents[]; taxCents: Cents[] }>();
  for (const line of lines) {
    const key = String(Number(line.ratePercent));
    const bucket = byRate.get(key) ?? { baseCents: [], taxCents: [] };
    bucket.baseCents.push(line.baseCents);
    bucket.taxCents.push(line.taxCents);
    byRate.set(key, bucket);
  }
  return [...byRate.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([ratePercent, b]) => ({ ratePercent, baseCents: sumCents(b.baseCents), taxCents: sumCents(b.taxCents) }));
}
