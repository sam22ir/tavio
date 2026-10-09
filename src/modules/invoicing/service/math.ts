import { applyRate, roundHalfUp, type Cents } from '@/core/money';
import { DZ_STAMP_DUTY_TIERS } from '@/modules/l10n_dz';

export interface LineInput {
  quantity: string;        // decimal string, up to 3 places
  unitPriceCents: Cents;
  ratePercent: string;     // "19", "9.0000"
}

export interface LineTotals { subtotalCents: Cents; taxCents: Cents }

const QTY_RE = /^\d+(\.\d{1,3})?$/;

/** Parses a quantity into thousandths without floats. Returns null when invalid or zero. */
export function parseQtyMilli(quantity: string): bigint | null {
  const m = QTY_RE.exec(quantity.trim());
  if (!m) return null;
  const frac = (m[1] ?? '.').slice(1).padEnd(3, '0');
  const milli = BigInt(m[0].split('.')[0] as string) * BigInt(1000) + BigInt(frac || '0');
  return milli > BigInt(0) ? milli : null;
}

/** Line subtotal = quantity * unit price, rounded half-up to the centime. Tax = applyRate(subtotal). */
export function computeLine(line: LineInput): LineTotals {
  const qty = parseQtyMilli(line.quantity);
  if (qty === null) throw new RangeError(`invalid quantity "${line.quantity}"`);
  if (line.unitPriceCents < BigInt(0)) throw new RangeError('negative unit price');
  const subtotalCents = roundHalfUp(qty * line.unitPriceCents, BigInt(1000));
  return { subtotalCents, taxCents: applyRate(subtotalCents, line.ratePercent) };
}

export interface DocTotals {
  untaxedCents: Cents;
  taxCents: Cents;
  lines: LineTotals[];
  taxGroups: { ratePercent: string; baseCents: Cents; taxCents: Cents }[];
}

/** Sums lines and groups tax by rate, in first-seen order. */
export function computeTotals(lines: LineInput[]): DocTotals {
  const totals = lines.map(computeLine);
  const groups = new Map<string, { ratePercent: string; baseCents: Cents; taxCents: Cents }>();
  let untaxed = BigInt(0);
  let tax = BigInt(0);
  lines.forEach((line, i) => {
    const t = totals[i] as LineTotals;
    untaxed += t.subtotalCents;
    tax += t.taxCents;
    const key = normalizeRate(line.ratePercent);
    const g = groups.get(key) ?? { ratePercent: key, baseCents: BigInt(0), taxCents: BigInt(0) };
    g.baseCents += t.subtotalCents;
    g.taxCents += t.taxCents;
    groups.set(key, g);
  });
  return { untaxedCents: untaxed, taxCents: tax, lines: totals, taxGroups: [...groups.values()] };
}

function normalizeRate(rate: string): string {
  return Number(rate).toFixed(4).replace(/\.?0+$/, '') || '0';
}

/**
 * Timbre fiscal for a cash payment, from DZ_STAMP_DUTY_TIERS. Amount is whole DA (centimes dropped).
 * A tier covers [minAmountDa, maxAmountDa) so boundary amounts fall in exactly one tier.
 * ⚠ needs accountant verification
 */
export function stampDutyCents(amountCents: Cents): Cents {
  const da = Number(amountCents / BigInt(100));
  const tier = DZ_STAMP_DUTY_TIERS.find(
    (t) => da >= t.minAmountDa && (t.maxAmountDa === null || da < t.maxAmountDa),
  );
  if (!tier) return BigInt(0);
  return BigInt(Math.round(tier.dutyDa * 100));
}

export type PaymentState = 'not_paid' | 'partial' | 'paid';

export function paymentStateFor(paid: Cents, total: Cents): PaymentState {
  if (paid <= BigInt(0)) return 'not_paid';
  return paid >= total ? 'paid' : 'partial';
}
