// Quantities are numeric(14,3). Arithmetic runs on bigint thousandths to avoid float error.

const SIGNED_QTY_RE = /^-?\d{1,11}(\.\d{1,3})?$/;
const POSITIVE_QTY_RE = /^\d{1,11}(\.\d{1,3})?$/;

/** Parses a decimal quantity string into thousandths. Returns null when malformed. */
export function toMilli(raw: string): bigint | null {
  const value = raw.trim();
  if (!SIGNED_QTY_RE.test(value)) return null;
  const negative = value.startsWith('-');
  const [whole = '0', frac = ''] = (negative ? value.slice(1) : value).split('.');
  const milli = BigInt(whole) * 1000n + BigInt(frac.padEnd(3, '0'));
  return negative ? -milli : milli;
}

/** Formats thousandths as a numeric(14,3) string, e.g. 12500n -> "12.500", -3n -> "-0.003". */
export function fromMilli(milli: bigint): string {
  const negative = milli < 0n;
  const abs = negative ? -milli : milli;
  const whole = abs / 1000n;
  const frac = (abs % 1000n).toString().padStart(3, '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

/** Returns the normalised quantity when it is a positive value with at most 3 decimals, else null. */
export function parsePositiveQty(raw: string): string | null {
  const value = raw.trim();
  if (!POSITIVE_QTY_RE.test(value)) return null;
  const milli = toMilli(value);
  if (milli === null || milli <= 0n) return null;
  return fromMilli(milli);
}

/** Returns the non-negative counted quantity normalised, or null. */
export function parseCountedQty(raw: string): string | null {
  const value = raw.trim();
  if (!POSITIVE_QTY_RE.test(value)) return null;
  const milli = toMilli(value);
  return milli === null ? null : fromMilli(milli);
}

/** Sums decimal strings exactly. Entries that fail to parse are skipped and counted. */
export function sumQty(values: readonly string[]): { total: bigint; invalid: number } {
  let total = 0n;
  let invalid = 0;
  for (const v of values) {
    const m = toMilli(v);
    if (m === null) invalid += 1;
    else total += m;
  }
  return { total, invalid };
}
