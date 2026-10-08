import { formatDzd } from '@/core/money';
import type { FieldDef } from '@/core/entities/types';
import fr from '../../../messages/fr';
import ar from '../../../messages/ar';
import en from '../../../messages/en';

type Locale = 'fr' | 'ar' | 'en';
const catalogs: Record<Locale, Record<string, unknown>> = { fr, ar, en };
const DASH = '–';
const TZ = 'Africa/Algiers';

/** Resolves a dotted i18n key (e.g. "contacts.type.company") against the message catalog. Falls back to the key. */
export function translateKey(key: string, locale: Locale): string {
  const segments = key.split('.');
  const [ns, ...rest] = segments;
  const root = catalogs[locale];
  let node: unknown = ns ? root[ns] : undefined;
  for (const seg of rest) {
    if (node && typeof node === 'object' && seg in node) node = (node as Record<string, unknown>)[seg];
    else return key;
  }
  return typeof node === 'string' ? node : key;
}

function toBigIntCents(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return BigInt(value.trim());
  return null;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Formats a row value for display according to its field type. Missing values render as an en dash. */
export function formatCell(field: FieldDef, value: unknown, locale: Locale): string {
  if (value === null || value === undefined || value === '') return DASH;

  switch (field.type) {
    case 'money': {
      const cents = toBigIntCents(value);
      return cents === null ? DASH : formatDzd(cents, locale);
    }
    case 'date':
    case 'datetime': {
      const d = toDate(value);
      if (!d) return DASH;
      const options: Intl.DateTimeFormatOptions =
        field.type === 'date'
          ? { dateStyle: 'medium', timeZone: TZ }
          : { dateStyle: 'medium', timeZone: TZ, timeStyle: 'short' };
      return new Intl.DateTimeFormat(locale, options).format(d);
    }
    case 'boolean':
      return value ? '✓' : DASH;
    case 'select': {
      const opt = field.options?.find((o) => o.value === String(value));
      return opt ? translateKey(opt.label, locale) : String(value);
    }
    default:
      return String(value);
  }
}
