// Pure POS arithmetic. No I/O, no floats: quantities are thousandths (bigint), money is cents (bigint).
import { applyRate, roundHalfUp, sumCents, type Cents } from '@/core/money';

const THOUSAND = BigInt(1000);
const ZERO = BigInt(0);

/** Parses a quantity string ("2", "1.5", "0.250") into thousandths. Returns null when invalid or zero. */
export function parseQuantityMilli(input: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,3}))?$/.exec(input.trim());
  if (!match) return null;
  const milli = BigInt(match[1] as string) * THOUSAND + BigInt((match[2] ?? '').padEnd(3, '0') || '0');
  return milli > ZERO ? milli : null;
}

export interface PosLineInput {
  unitPriceCents: Cents;
  quantityMilli: bigint;
  taxRate: string;            // percent, e.g. "19" or "19.0000"
}

export interface PosLineAmounts {
  subtotalCents: Cents;
  taxCents: Cents;
}

/** Line subtotal = round(unit price * quantity), then tax = applyRate(subtotal, rate). */
export function lineAmounts(line: PosLineInput): PosLineAmounts {
  const subtotalCents = roundHalfUp(line.unitPriceCents * line.quantityMilli, THOUSAND);
  return { subtotalCents, taxCents: applyRate(subtotalCents, line.taxRate) };
}

export interface PosTotals {
  untaxedCents: Cents;
  taxCents: Cents;
  totalCents: Cents;
}

export function orderTotals(lines: readonly PosLineAmounts[]): PosTotals {
  const untaxedCents = sumCents(lines.map((l) => l.subtotalCents));
  const taxCents = sumCents(lines.map((l) => l.taxCents));
  return { untaxedCents, taxCents, totalCents: untaxedCents + taxCents };
}

/** Expected cash in drawer = opening float + cash sales. */
export function expectedCash(openingCents: Cents, cashSalesCents: Cents): Cents {
  return openingCents + cashSalesCents;
}

/** Change due for a cash payment, or null when the tender does not cover the total. */
export function changeDue(totalCents: Cents, tenderedCents: Cents): Cents | null {
  return tenderedCents >= totalCents ? tenderedCents - totalCents : null;
}
