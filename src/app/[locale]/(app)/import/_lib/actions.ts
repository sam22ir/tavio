'use server';

import { z } from 'zod';
import { withPageCtx } from '@/core/actions/page-ctx';
import type { Ctx } from '@/core/ctx';
import { commitMessageText, mapRecord, type ImportMapping, type IoLocale } from '@/core/io';
import { requirePerm } from '@/core/perms';
import { IMPORT_TARGETS, isImportEntity, type ImportTarget } from './targets';

const PREVIEW_ROWS = 20;
const BATCH_ROWS = 200;
const MAX_IMPORT_ROWS = 10000;
const MAX_WHOLE_ROWS = 2000;

const mappingSchema = z.record(z.string(), z.number().int().nonnegative().nullable());
const cellRows = z.array(z.array(z.string().max(5000)).max(200));
const localeSchema = z.enum(['fr', 'ar', 'en']).optional();

const previewInput = z.object({
  entity: z.string(),
  mapping: mappingSchema,
  rows: cellRows.max(PREVIEW_ROWS),
  total: z.number().int().min(0).max(MAX_IMPORT_ROWS),
  locale: localeSchema,
});
const batchInput = z.object({
  entity: z.string(),
  mapping: mappingSchema,
  rows: cellRows.max(BATCH_ROWS),
  offset: z.number().int().min(0).max(MAX_IMPORT_ROWS),
  locale: localeSchema,
});
const wholeInput = z.object({
  entity: z.string(),
  mapping: mappingSchema,
  rows: cellRows.max(MAX_WHOLE_ROWS),
  locale: localeSchema,
});

export interface PreviewRow {
  line: number;                       // file line, header is line 1
  status: 'ok' | 'error' | 'duplicate';
  messages: string[];
  values: string[];                   // mapped values, in target field order, for display
}

export interface BatchError {
  index: number;                      // 0-based row index in the data rows
  line: number;
  messages: string[];
}

export interface WholeFileResult {
  created: number;
  errors: BatchError[];
}

/** Failures carry a translation key, and optional values for it (for example the balance difference). */
export type ActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; messageKey: string; params?: Record<string, string> };

function checkEntity(name: string): ImportTarget | null {
  return isImportEntity(name) ? IMPORT_TARGETS[name] : null;
}

/** Existing duplicate keys plus any collected while processing this request. */
async function knownKeys(ctx: Ctx, target: ImportTarget): Promise<Set<string>> {
  return target.existingKeys ? target.existingKeys(ctx) : new Set<string>();
}

/** Today's date in Algiers, as YYYY-MM-DD. Opening entries are written at this day's fiscal year. */
function todayAlgiers(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(new Date());
}

function messagesFor(messages: { field?: string; message: string }[], locale: IoLocale): string[] {
  return messages.map((x) => (x.field ? `${x.field}: ${commitMessageText(x.message, locale)}` : commitMessageText(x.message, locale)));
}

/** Checks the first rows against validation and existing records, without writing anything. */
export async function previewImport(input: z.input<typeof previewInput>): Promise<ActionResult<{ rows: PreviewRow[] }>> {
  const parsed = previewInput.safeParse(input);
  if (!parsed.success) return { ok: false, messageKey: 'io.import.failed' };
  const target = checkEntity(parsed.data.entity);
  if (!target) return { ok: false, messageKey: 'io.import.failed' };
  const mapping: ImportMapping = parsed.data.mapping;
  const locale: IoLocale = parsed.data.locale ?? 'fr';

  try {
    const rows = await withPageCtx(async (ctx): Promise<PreviewRow[]> => {
      const perm = requirePerm(ctx, target.writePerm);
      if (!perm.ok) throw new Error('FORBIDDEN');
      const known = await knownKeys(ctx, target);
      return parsed.data.rows.map((record, i): PreviewRow => {
        const raw = mapRecord(record, mapping);
        const values = target.fieldKeys.map((k) => raw[k] ?? '');
        const line = i + 2;
        const result = target.parse(raw, locale);
        if (!result.ok) {
          return { line, status: 'error', messages: messagesFor(result.issues, locale), values };
        }
        if (result.keys.some((k) => known.has(k))) {
          return { line, status: 'duplicate', messages: [], values };
        }
        for (const k of result.keys) known.add(k);
        return { line, status: 'ok', messages: [], values };
      });
    });
    return { ok: true, value: { rows } };
  } catch {
    return { ok: false, messageKey: 'io.import.failed' };
  }
}

/** Creates one batch of up to 200 rows in a single tenant transaction. Invalid and duplicate rows are counted, not written. */
export async function importBatch(
  input: z.input<typeof batchInput>,
): Promise<ActionResult<{ created: number; skipped: number; errors: BatchError[] }>> {
  const parsed = batchInput.safeParse(input);
  if (!parsed.success) return { ok: false, messageKey: 'io.import.failed' };
  const target = checkEntity(parsed.data.entity);
  if (!target || target.wholeFile) return { ok: false, messageKey: 'io.import.failed' };
  const mapping: ImportMapping = parsed.data.mapping;
  const locale: IoLocale = parsed.data.locale ?? 'fr';
  const { offset } = parsed.data;

  try {
    const value = await withPageCtx(async (ctx) => {
      const perm = requirePerm(ctx, target.writePerm);
      if (!perm.ok) throw new Error('FORBIDDEN');
      const known = await knownKeys(ctx, target);
      let created = 0;
      let skipped = 0;
      const errors: BatchError[] = [];
      for (let j = 0; j < parsed.data.rows.length; j++) {
        const record = parsed.data.rows[j] ?? [];
        const index = offset + j;
        const line = index + 2;
        const raw = mapRecord(record, mapping);
        const result = target.parse(raw, locale);
        if (!result.ok) {
          errors.push({ index, line, messages: messagesFor(result.issues, locale) });
          continue;
        }
        if (result.keys.some((k) => known.has(k))) {
          skipped++;
          continue;
        }
        const outcome = await result.create(ctx);
        if (!outcome.ok) {
          errors.push({ index, line, messages: [commitMessageText(outcome.error.message, locale)] });
          continue;
        }
        created++;
        for (const k of result.keys) known.add(k);
      }
      return { created, skipped, errors };
    });
    return { ok: true, value };
  } catch {
    return { ok: false, messageKey: 'io.import.failed' };
  }
}

/**
 * Imports a whole file in one transaction for targets that must see every row together:
 * the opening balance entry (balanced as a whole) and quotes grouped by order ref.
 */
export async function importWhole(input: z.input<typeof wholeInput>): Promise<ActionResult<WholeFileResult>> {
  const parsed = wholeInput.safeParse(input);
  if (!parsed.success) return { ok: false, messageKey: 'io.import.failed' };
  const target = checkEntity(parsed.data.entity);
  if (!target?.wholeFile) return { ok: false, messageKey: 'io.import.failed' };
  const mapping: ImportMapping = parsed.data.mapping;
  const locale: IoLocale = parsed.data.locale ?? 'fr';
  const commit = target.wholeFile.commit;

  try {
    const outcome = await withPageCtx(async (ctx) => {
      const perm = requirePerm(ctx, target.writePerm);
      if (!perm.ok) return { ok: false as const, messageKey: 'io.import.failed' };

      const items: { line: number; value: unknown }[] = [];
      const errors: BatchError[] = [];
      parsed.data.rows.forEach((record, index) => {
        const line = index + 2;
        const result = target.parse(mapRecord(record, mapping), locale);
        if (!result.ok) errors.push({ index, line, messages: messagesFor(result.issues, locale) });
        else items.push({ line, value: result.value });
      });
      if (errors.length > 0) return { ok: true as const, value: { created: 0, errors } };

      const written = await commit(ctx, items, { today: todayAlgiers() });
      if (!written.ok) {
        if (written.error.message === 'OPENING_UNBALANCED') {
          return { ok: false as const, messageKey: 'io.import.opening_unbalanced', params: { difference: String(written.error.details?.difference ?? '') } };
        }
        return { ok: false as const, messageKey: 'io.import.failed' };
      }
      const lineErrors = written.value.errors.map((e) => ({
        index: e.line - 2,
        line: e.line,
        messages: [commitMessageText(e.message, locale)],
      }));
      return { ok: true as const, value: { created: written.value.created, errors: lineErrors } };
    });
    return outcome;
  } catch {
    return { ok: false, messageKey: 'io.import.failed' };
  }
}
