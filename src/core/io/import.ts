import type { ZodType } from 'zod';

// Pure import logic: header matching, column mapping and row validation. No database access here.

export interface ImportField {
  key: string;                    // zod input key of the target entity
  label: string;                  // localized label for the current locale
  aliases: readonly string[];     // labels in fr/ar/en, matched against headers
  required?: boolean;
}

/** Target field key -> column index in the file, or null when not mapped. */
export type ImportMapping = Record<string, number | null>;

/** Lowercase, accents removed, punctuation and spaces removed. Letters of any script are kept (Arabic works). */
export function normalizeHeader(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/** Matches each target field to the first header whose normalized text equals its key, label or an alias. */
export function autoMapColumns(headers: readonly string[], fields: readonly ImportField[]): ImportMapping {
  const normalized = headers.map(normalizeHeader);
  const used = new Set<number>();
  const mapping: ImportMapping = {};
  for (const field of fields) {
    const candidates = new Set(
      [field.key, field.label, ...field.aliases].map(normalizeHeader).filter((c) => c.length > 0),
    );
    let found: number | null = null;
    for (let i = 0; i < normalized.length; i++) {
      if (used.has(i)) continue;
      if (candidates.has(normalized[i] as string)) {
        found = i;
        break;
      }
    }
    if (found !== null) used.add(found);
    mapping[field.key] = found;
  }
  return mapping;
}

/** Turns one CSV record into a raw object keyed by target field, using the mapping. Missing cells become ''. */
export function mapRecord(record: readonly string[], mapping: ImportMapping): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, index] of Object.entries(mapping)) {
    out[key] = index === null ? '' : (record[index] ?? '').trim();
  }
  return out;
}

export interface RowIssue {
  field: string;     // '' for a row-level issue
  message: string;
}

export type RowResult<T> = { ok: true; value: T } | { ok: false; issues: RowIssue[] };

/** Validates a raw row with the entity's zod input schema and returns localized-neutral issues (field + English message). */
export function validateRow<T>(schema: ZodType<T>, raw: Record<string, unknown>): RowResult<T> {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, value: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
  };
}

/** Required target fields that have no mapped column. Blocks the mapping step. */
export function missingRequired(mapping: ImportMapping, fields: readonly ImportField[]): string[] {
  return fields.filter((f) => f.required && mapping[f.key] === null).map((f) => f.key);
}

/** Parses a yes/no style cell: oui, yes, vrai, true, 1, x, نعم. Anything else is false. */
export function parseBooleanText(value: string): 'true' | 'false' {
  const v = normalizeHeader(value);
  return ['oui', 'yes', 'vrai', 'true', '1', 'x', 'نعم'].includes(v) ? 'true' : 'false';
}
