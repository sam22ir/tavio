import { and, eq, sql } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { sequences } from '@/core/db/schema';

const YEAR_FORMAT = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Algiers', year: 'numeric' });

/** Gap-free next number for (ctx.companyId, code), e.g. 'FAC-2026-00001'. Creates the sequence row on first use. */
export async function nextNumber(
  ctx: Ctx,
  code: string,
  defaults?: { prefix?: string; padding?: number },
): Promise<string> {
  const { tx, companyId } = ctx;
  await tx
    .insert(sequences)
    .values({
      companyId,
      code,
      prefix: defaults?.prefix ?? '',
      padding: defaults?.padding ?? 5,
    })
    .onConflictDoNothing({ target: [sequences.companyId, sequences.code] });

  // Row-locking update: concurrent callers serialise here, and a rollback also rolls back the increment.
  const [row] = await tx
    .update(sequences)
    .set({ nextNumber: sql`${sequences.nextNumber} + 1` })
    .where(and(eq(sequences.companyId, companyId), eq(sequences.code, code)))
    .returning({
      n: sql<number>`${sequences.nextNumber} - 1`,
      prefix: sequences.prefix,
      padding: sequences.padding,
    });
  if (!row) throw new Error(`sequence ${code} missing after upsert`);

  const prefix = row.prefix.replaceAll('{YYYY}', YEAR_FORMAT.format(new Date()));
  return `${prefix}${String(row.n).padStart(row.padding, '0')}`;
}
