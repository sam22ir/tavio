// Display helpers for delivery quantities. Pure: thousandths arithmetic, no float.

/** Formats a numeric(14,3) quantity with three decimals ("3" -> "3.000"). */
export function toMilliText(raw: string): string {
  const [whole = '0', frac = ''] = raw.trim().split('.');
  return `${whole}.${frac.padEnd(3, '0').slice(0, 3)}`;
}

/** Ordered minus delivered, floored at zero, as a three-decimal string. */
export function remainingOf(ordered: string, delivered: string): string {
  const toM = (v: string): bigint => {
    const [whole = '0', frac = ''] = v.trim().split('.');
    return BigInt(whole) * 1000n + BigInt(frac.padEnd(3, '0').slice(0, 3));
  };
  const left = toM(ordered) - toM(delivered);
  const m = left < 0n ? 0n : left;
  return `${m / 1000n}.${(m % 1000n).toString().padStart(3, '0')}`;
}
