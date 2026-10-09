// Pure money and quantity arithmetic for purchase orders. No floats: quantities are thousandths (bigint).
import { applyRate, roundHalfUp, type Cents } from '@/core/money';

const THOUSAND = BigInt(1000);
const ZERO = BigInt(0);
export const QTY_RE = /^(\d+)(?:\.(\d{1,3}))?$/;

/** Parses a decimal quantity ("2", "2.5", "2.250") into thousandths. Returns null when invalid or zero. */
export function parseQty(input: string): bigint | null {
  const match = QTY_RE.exec(input.trim());
  if (!match) return null;
  const whole = BigInt(match[1] as string);
  const frac = BigInt((match[2] ?? '').padEnd(3, '0') || '0');
  const value = whole * THOUSAND + frac;
  return value > ZERO ? value : null;
}

/** Formats thousandths as a numeric(14,3) string: 2500 → "2.500". Accepts zero. */
export function formatQty(thousandths: bigint): string {
  const whole = thousandths / THOUSAND;
  const frac = thousandths % THOUSAND;
  return `${whole.toString()}.${frac.toString().padStart(3, '0')}`;
}

export interface LineAmounts {
  subtotalCents: Cents;
  taxCents: Cents;
}

/** subtotal = quantity × unit price, rounded half-up to the centime; tax = subtotal × rate (percent string). */
export function lineAmounts(input: {
  quantity: string;
  unitPriceCents: Cents;
  ratePercent: string | null;
}): LineAmounts {
  const qty = parseQty(input.quantity);
  if (qty === null) throw new RangeError(`lineAmounts: invalid quantity "${input.quantity}"`);
  const subtotalCents = roundHalfUp(qty * input.unitPriceCents, THOUSAND);
  const taxCents = input.ratePercent === null ? ZERO : applyRate(subtotalCents, input.ratePercent);
  return { subtotalCents, taxCents };
}

export function sumTotals(lines: readonly LineAmounts[]): { untaxedCents: Cents; taxCents: Cents; totalCents: Cents } {
  const untaxedCents = lines.reduce<Cents>((acc, l) => acc + l.subtotalCents, ZERO);
  const taxCents = lines.reduce<Cents>((acc, l) => acc + l.taxCents, ZERO);
  return { untaxedCents, taxCents, totalCents: untaxedCents + taxCents };
}

/** Remaining quantity to receive, in thousandths. Never negative. */
export function remainingQty(quantity: string, receivedQty: string): bigint {
  const ordered = parseQty(quantity) ?? ZERO;
  const received = parseQty(receivedQty) ?? ZERO;
  const left = ordered - received;
  return left > ZERO ? left : ZERO;
}
