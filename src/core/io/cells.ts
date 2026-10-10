// Cell formatting shared by the CSV and XLSX writers. Values are plain text or numbers, never locale-formatted strings.

export type IoCellType = 'text' | 'number' | 'money' | 'date' | 'datetime' | 'boolean';

export interface IoColumn {
  key: string;        // property of the row object
  header: string;     // localized header text
  type?: IoCellType;
}

export type IoRow = Readonly<Record<string, unknown>>;

export interface IoBooleanText {
  true: string;
  false: string;
}

const ISO_DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})/;

/** Converts money stored as integer cents (bigint, numeric string or number) to a DZD decimal string with 2 places. */
export function centsToDecimal(value: unknown): string | null {
  let cents: bigint;
  if (typeof value === 'bigint') cents = value;
  else if (typeof value === 'number' && Number.isInteger(value)) cents = BigInt(value);
  else if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) cents = BigInt(value.trim());
  else return null;
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole.toString()}.${frac}`;
}

/** Converts a value to the text written to a cell. Money uses decimal DZD, dates are ISO. */
export function cellToText(value: unknown, type: IoCellType | undefined, bool: IoBooleanText): string {
  if (value === null || value === undefined) return '';
  switch (type) {
    case 'money':
      return centsToDecimal(value) ?? '';
    case 'number':
      return typeof value === 'number' || typeof value === 'bigint' || typeof value === 'string' ? String(value) : '';
    case 'boolean':
      return value === true || value === 'true' ? bool.true : value === false || value === 'false' ? bool.false : '';
    case 'date': {
      if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
      const match = ISO_DATE_PREFIX.exec(String(value));
      return match?.[1] ?? '';
    }
    case 'datetime': {
      if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
      const d = new Date(String(value));
      return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
    }
    default:
      return String(value);
  }
}

/** Numeric cell value for XLSX, or null when the cell should be written as text. */
export function cellToNumber(value: unknown, type: IoCellType | undefined): number | null {
  if (type !== 'money' && type !== 'number') return null;
  if (value === null || value === undefined || value === '') return null;
  if (type === 'money') {
    const decimal = centsToDecimal(value);
    return decimal === null ? null : Number(decimal);
  }
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
