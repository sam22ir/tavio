import { applyRate, roundHalfUp, sumCents, type Cents } from '@/core/money';

// Pure order math (W5-A). No I/O, no floats: quantities and discounts are parsed to scaled bigints.
const QTY_SCALE = BigInt(1000); // 3 decimals
const RATE_SCALE = BigInt(10000); // 4 decimals
const HUNDRED = BigInt(100);
const ONE_HUNDRED_PERCENT = HUNDRED * RATE_SCALE; // 100 with 4 decimals
const ZERO = BigInt(0);

export interface LineInput {
  quantity: string; // decimal string, up to 3 decimals, > 0
  unitPriceCents: Cents; // >= 0
  discountRate: string; // percent, 0 to 100, up to 4 decimals
  taxRate: string | null; // percent from taxes.rate, e.g. "19.0000"; null = no tax
}

export interface LineTotals {
  subtotalCents: Cents;
  taxCents: Cents;
}

export interface OrderTotals {
  untaxedCents: Cents;
  taxCents: Cents;
  totalCents: Cents;
  lines: LineTotals[];
}

/** Parses "2", "2.5", "2.250" into a quantity scaled by 1000. Returns null when invalid or not positive. */
export function parseQuantity(input: string): bigint | null {
  const match = /^(\d{1,11})(?:\.(\d{1,3}))?$/.exec(input.trim());
  if (!match) return null;
  const whole = BigInt(match[1] as string);
  const frac = BigInt((match[2] ?? '').padEnd(3, '0') || '0');
  const scaled = whole * QTY_SCALE + frac;
  return scaled > ZERO ? scaled : null;
}

/** Parses a percent such as "10" or "7.5" into a rate scaled by 10^4. Returns null outside 0..100. */
export function parseDiscountRate(input: string): bigint | null {
  const trimmed = input.trim() === '' ? '0' : input.trim();
  const match = /^(\d{1,3})(?:\.(\d{1,4}))?$/.exec(trimmed);
  if (!match) return null;
  const whole = BigInt(match[1] as string);
  const frac = BigInt((match[2] ?? '').padEnd(4, '0') || '0');
  const scaled = whole * RATE_SCALE + frac;
  return scaled <= ONE_HUNDRED_PERCENT ? scaled : null;
}

/**
 * Line subtotal = qty * unitPrice * (1 - discount), rounded half-up to the centime.
 * qtyScaled is quantity * 1000, discountScaled is percent * 10^4.
 */
export function lineSubtotal(qtyScaled: bigint, unitPriceCents: Cents, discountScaled: bigint): Cents {
  const numerator = qtyScaled * unitPriceCents * (ONE_HUNDRED_PERCENT - discountScaled);
  const denominator = QTY_SCALE * ONE_HUNDRED_PERCENT;
  return roundHalfUp(numerator, denominator);
}

/** Computes every line's subtotal and tax, then the order totals. Throws RangeError on invalid input. */
export function computeOrderTotals(lines: readonly LineInput[]): OrderTotals {
  const computed: LineTotals[] = lines.map((line) => {
    const qty = parseQuantity(line.quantity);
    const disc = parseDiscountRate(line.discountRate);
    if (qty === null) throw new RangeError(`invalid quantity "${line.quantity}"`);
    if (disc === null) throw new RangeError(`invalid discount "${line.discountRate}"`);
    if (line.unitPriceCents < ZERO) throw new RangeError('unit price must be >= 0');
    const subtotalCents = lineSubtotal(qty, line.unitPriceCents, disc);
    const taxCents = line.taxRate === null ? ZERO : applyRate(subtotalCents, line.taxRate);
    return { subtotalCents, taxCents };
  });
  const untaxedCents = sumCents(computed.map((l) => l.subtotalCents));
  const taxCents = sumCents(computed.map((l) => l.taxCents));
  return { untaxedCents, taxCents, totalCents: untaxedCents + taxCents, lines: computed };
}
