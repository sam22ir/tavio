

/** "2026-03-14" or a Date, formatted for the locale. Dates are shown as calendar days, not shifted by timezone. */
export function portalDate(value: string | Date, locale: string): string {
  const date = typeof value === 'string' ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : value;
  return new Intl.DateTimeFormat(`${locale}-DZ`, { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}

