'use server';

import { z } from 'zod';
import { withPageCtx } from '@/core/actions/page-ctx';
import type { Ctx } from '@/core/ctx';
import { mapRecord, type ImportMapping } from '@/core/io';
import { requirePerm } from '@/core/perms';
import { IMPORT_TARGETS, isImportEntity, type ImportTarget } from './targets';

const PREVIEW_ROWS = 20;
const BATCH_ROWS = 200;
const MAX_IMPORT_ROWS = 10000;

const mappingSchema = z.record(z.string(), z.number().int().nonnegative().nullable());
const cellRows = z.array(z.array(z.string().max(5000)).max(200));

const previewInput = z.object({
  entity: z.string(),
  mapping: mappingSchema,
  rows: cellRows.max(PREVIEW_ROWS),
  total: z.number().int().min(0).max(MAX_IMPORT_ROWS),
});
const batchInput = z.object({
  entity: z.string(),
  mapping: mappingSchema,
  rows: cellRows.max(BATCH_ROWS),
  offset: z.number().int().min(0).max(MAX_IMPORT_ROWS),
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

export type ActionResult<T> = { ok: true; value: T } | { ok: false; messageKey: string };

function checkEntity(name: string): ImportTarget | null {
  return isImportEntity(name) ? IMPORT_TARGETS[name] : null;
}

/** Existing duplicate keys plus any collected while processing this request. */
async function knownKeys(ctx: Ctx, target: ImportTarget): Promise<Set<string>> {
  return target.existingKeys ? target.existingKeys(ctx) : new Set<string>();
}

/** Checks the first rows against validation and existing records, without writing anything. */
export async function previewImport(input: z.input<typeof previewInput>): Promise<ActionResult<{ rows: PreviewRow[] }>> {
  const parsed = previewInput.safeParse(input);
  if (!parsed.success) return { ok: false, messageKey: 'io.import.failed' };
  const target = checkEntity(parsed.data.entity);
  if (!target) return { ok: false, messageKey: 'io.import.failed' };
  const mapping: ImportMapping = parsed.data.mapping;

  try {
    const rows = await withPageCtx(async (ctx): Promise<PreviewRow[]> => {
      const perm = requirePerm(ctx, target.writePerm);
      if (!perm.ok) throw new Error('FORBIDDEN');
      const known = await knownKeys(ctx, target);
      return parsed.data.rows.map((record, i): PreviewRow => {
        const raw = mapRecord(record, mapping);
        const values = target.fieldKeys.map((k) => raw[k] ?? '');
        const line = i + 2;
        const result = target.parse(raw);
        if (!result.ok) {
          return { line, status: 'error', messages: result.issues.map((x) => (x.field ? `${x.field}: ${x.message}` : x.message)), values };
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
  if (!target) return { ok: false, messageKey: 'io.import.failed' };
  const mapping: ImportMapping = parsed.data.mapping;
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
        const result = target.parse(raw);
        if (!result.ok) {
          errors.push({ index, line, messages: result.issues.map((x) => (x.field ? `${x.field}: ${x.message}` : x.message)) });
          continue;
        }
        if (result.keys.some((k) => known.has(k))) {
          skipped++;
          continue;
        }
        const outcome = await result.create(ctx);
        if (!outcome.ok) {
          errors.push({ index, line, messages: [outcome.error.message] });
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
