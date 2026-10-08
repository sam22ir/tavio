import type { Row } from '@/core/entities/types';

// DZD text input value for a bigint cents amount, e.g. 150050n -> "1500.50". parseDzd accepts it back.
export function centsToInput(c: unknown): string {
  if (typeof c !== 'bigint') return '';
  const whole = c / BigInt(100);
  const frac = c % BigInt(100);
  return `${whole.toString()}.${frac.toString().padStart(2, '0')}`;
}

export function categoryIdParam(raw: string | string[] | undefined): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined;
}

export function toFormValues(row: Row): Partial<Row> {
  return { ...row, salePriceCents: centsToInput(row.salePriceCents), costCents: centsToInput(row.costCents) };
}
