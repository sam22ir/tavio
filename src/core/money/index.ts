export type Cents = bigint;

const SCALE = BigInt(10000); // rate precision: 4 decimal places

const CENTS_PER_UNIT = BigInt(100);
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);

/**
 * Parses a DZD amount typed by a user. Accepts "1234", "1234.5", "1 234,50",
 * "1234,5 DA". Spaces and NBSP are thousands separators. "," or "." is the
 * decimal mark, at most 2 decimals. Returns null when invalid.
 */
export function parseDzd(input: string): Cents | null {
  const stripped = input
    .trim()
    .replace(/\s*(DA|DZD)$/i, '')
    .replace(/[   ]/g, '');
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(stripped);
  if (!match) return null;
  const whole = BigInt(match[1] as string);
  const frac = match[2] ?? '';
  const fracCents = BigInt(frac.padEnd(2, '0') || '0');
  return whole * CENTS_PER_UNIT + fracCents;
}

/**
 * Formats cents with Intl. Whole units are passed as bigint, never Number(cents) / 100.
 */
export function formatDzd(c: Cents, locale: 'fr' | 'ar' | 'en'): string {
  const loc = `${locale}-DZ`;
  const nf = new Intl.NumberFormat(loc, {
    style: 'currency',
    currency: 'DZD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const nfFrac = new Intl.NumberFormat(loc, { minimumIntegerDigits: 2, useGrouping: false });

  const isNeg = c < ZERO;
  const abs = isNeg ? -c : c;
  const whole = abs / CENTS_PER_UNIT;
  const frac = abs % CENTS_PER_UNIT;
  // -0 keeps the sign when the whole part is zero (bigint has no negative zero).
  const value: number | bigint = isNeg ? (whole === ZERO ? -0 : -whole) : whole;

  return nf
    .formatToParts(value)
    .map((p) => (p.type === 'fraction' ? nfFrac.format(frac) : p.value))
    .join('');
}

/** Rounds num / den to the nearest integer, halves away from zero. den must be > 0. */
export function roundHalfUp(num: bigint, den: bigint): bigint {
  if (den <= ZERO) throw new RangeError('roundHalfUp: den must be > 0');
  const q = num / den;
  const r = num % den;
  const absR2 = (r < ZERO ? -r : r) * TWO;
  if (absR2 < den) return q;
  return num < ZERO ? q - ONE : q + ONE;
}

/** Parses a decimal rate string ("19", "19.0000") into an integer scaled by 10^4, without floats. */
function parseRateScaled(ratePercent: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,4}))?$/.exec(ratePercent.trim());
  if (!match) throw new RangeError(`applyRate: invalid rate "${ratePercent}"`);
  const whole = BigInt(match[1] as string);
  const frac = BigInt((match[2] ?? '').padEnd(4, '0') || '0');
  return whole * SCALE + frac;
}

/** base * ratePercent / 100, rounded half-up to the centime. Example: applyRate(1000, "19") = 190. */
export function applyRate(base: Cents, ratePercent: string): Cents {
  return roundHalfUp(base * parseRateScaled(ratePercent), CENTS_PER_UNIT * SCALE);
}

/** Splits total into n parts. Parts are total / n truncated; the last part takes the remainder. */
export function splitEven(total: Cents, n: number): Cents[] {
  if (!Number.isInteger(n) || n < 1) throw new RangeError('splitEven: n must be an integer >= 1');
  const count = BigInt(n);
  const each = total / count;
  const parts: Cents[] = Array.from({ length: n - 1 }, () => each);
  parts.push(total - each * (count - ONE));
  return parts;
}

export function sumCents(xs: readonly Cents[]): Cents {
  return xs.reduce<Cents>((acc, x) => acc + x, ZERO);
}
