// Journal entries: post (balanced, numbered, immutable), reverse, list and detail.
import { and, desc, eq, ilike, inArray, or, count, sql } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { audit } from '@/core/audit';
import { err, ok, type Result } from '@/core/result';
import type { ListQuery, ListResult } from '@/core/entities/types';
import { nextNumber } from '@/core/sequences';
import { partners } from '@/modules/contacts/schema';
import { accounts, journalEntries, journalLines, journals } from '../schema';
import { ensureDefaults } from './chart';
import { checkBalanced, invertLines, type DraftLine } from './posting';
import { assertPeriodOpen } from './period';

const ALGIERS_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Algiers',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export interface PostEntryInput {
  journalCode: string;
  date: string;               // YYYY-MM-DD
  ref?: string | null;
  sourceEntity?: string | null;
  sourceId?: string | null;
  lines: DraftLine[];
}

/** Resolves account codes to ids for this company. Returns the missing codes, if any. */
async function accountIdsFor(ctx: Ctx, codes: string[]) {
  const unique = [...new Set(codes)];
  const rows = await ctx.tx
    .select({ id: accounts.id, code: accounts.code, archived: accounts.archived })
    .from(accounts)
    .where(and(eq(accounts.companyId, ctx.companyId), inArray(accounts.code, unique)));
  const byCode = new Map(rows.map((r) => [r.code, r.id]));
  const missing = unique.filter((c) => !byCode.has(c));
  const archived = rows.filter((r) => r.archived).map((r) => r.code);
  return { byCode, missing, archived };
}

/**
 * Validates Σdebit = Σcredit in code, then writes a posted entry with a per-journal number.
 * Idempotent by (sourceEntity, sourceId): an existing entry for the same source is returned as-is.
 */
export async function postEntry(
  ctx: Ctx,
  input: PostEntryInput,
): Promise<Result<{ id: string; number: string; existing: boolean }>> {
  const balance = checkBalanced(input.lines);
  if (!balance.ok) return balance;

  if (input.sourceEntity && input.sourceId) {
    const [existing] = await ctx.tx
      .select({ id: journalEntries.id, number: journalEntries.number })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.companyId, ctx.companyId),
          eq(journalEntries.sourceEntity, input.sourceEntity),
          eq(journalEntries.sourceId, input.sourceId),
        ),
      );
    if (existing) return ok({ ...existing, existing: true });
  }

  await ensureDefaults(ctx);
  const [journal] = await ctx.tx
    .select()
    .from(journals)
    .where(and(eq(journals.companyId, ctx.companyId), eq(journals.code, input.journalCode)));
  if (!journal) return err('NOT_FOUND', 'JOURNAL_NOT_FOUND');

  const period = await assertPeriodOpen(ctx, input.date);
  if (!period.ok) return period;

  const { byCode, missing, archived } = await accountIdsFor(ctx, input.lines.map((l) => l.accountCode));
  if (missing.length > 0) return err('NOT_FOUND', 'ACCOUNT_NOT_FOUND', { codes: missing });
  if (archived.length > 0) return err('CONFLICT', 'ACCOUNT_ARCHIVED', { codes: archived });

  const number = await nextNumber(ctx, `accounting.entry.${journal.code}`, {
    prefix: `${journal.code}/{YYYY}/`,
    padding: 5,
  });

  const [entry] = await ctx.tx
    .insert(journalEntries)
    .values({
      companyId: ctx.companyId,
      number,
      journalId: journal.id,
      date: input.date,
      ref: input.ref ?? null,
      sourceEntity: input.sourceEntity ?? null,
      sourceId: input.sourceId ?? null,
      state: 'posted',
      createdBy: ctx.userId,
    })
    .returning({ id: journalEntries.id });
  if (!entry) return err('INTERNAL', 'ENTRY_INSERT_FAILED');

  await ctx.tx.insert(journalLines).values(
    input.lines.map((l) => ({
      companyId: ctx.companyId,
      entryId: entry.id,
      accountId: byCode.get(l.accountCode)!,
      partnerId: l.partnerId ?? null,
      label: l.label ?? null,
      debitCents: l.debitCents,
      creditCents: l.creditCents,
      createdBy: ctx.userId,
    })),
  );

  await audit(ctx, {
    entity: 'accounting.entry',
    recordId: entry.id,
    action: 'post',
    after: { number, date: input.date, sourceEntity: input.sourceEntity ?? null, sourceId: input.sourceId ?? null },
  });
  return ok({ id: entry.id, number, existing: false });
}

/** Reverses a posted entry: posts the inverted lines and links the original to the reversal. Posted entries are never edited. */
export async function reverseEntry(ctx: Ctx, entryId: string): Promise<Result<{ id: string; number: string }>> {
  const [entry] = await ctx.tx
    .select({
      id: journalEntries.id,
      number: journalEntries.number,
      state: journalEntries.state,
      reversedById: journalEntries.reversedById,
      journalCode: journals.code,
    })
    .from(journalEntries)
    .innerJoin(journals, eq(journals.id, journalEntries.journalId))
    .where(and(eq(journalEntries.companyId, ctx.companyId), eq(journalEntries.id, entryId)));
  if (!entry) return err('NOT_FOUND', 'ENTRY_NOT_FOUND');
  if (entry.state !== 'posted') return err('STATE', 'ENTRY_NOT_POSTED');
  if (entry.reversedById) return err('CONFLICT', 'ENTRY_ALREADY_REVERSED');

  const lines = await ctx.tx
    .select({
      code: accounts.code,
      partnerId: journalLines.partnerId,
      label: journalLines.label,
      debitCents: journalLines.debitCents,
      creditCents: journalLines.creditCents,
    })
    .from(journalLines)
    .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
    .where(and(eq(journalLines.companyId, ctx.companyId), eq(journalLines.entryId, entry.id)));

  const draft: DraftLine[] = lines.map((l) => ({
    accountCode: l.code,
    partnerId: l.partnerId,
    label: l.label,
    debitCents: l.debitCents,
    creditCents: l.creditCents,
  }));

  const today = ALGIERS_DATE.format(new Date());
  const reversal = await postEntry(ctx, {
    journalCode: entry.journalCode,
    date: today,
    ref: `Reversal of ${entry.number}`,
    sourceEntity: 'accounting.reversal',
    sourceId: entry.id,
    lines: invertLines(draft),
  });
  if (!reversal.ok) return reversal;

  await ctx.tx
    .update(journalEntries)
    .set({ reversedById: reversal.value.id, updatedAt: sql`now()` })
    .where(eq(journalEntries.id, entry.id));

  await audit(ctx, {
    entity: 'accounting.entry',
    recordId: entry.id,
    action: 'reverse',
    after: { reversedById: reversal.value.id },
  });
  return ok({ id: reversal.value.id, number: reversal.value.number });
}

/** Edits header fields. Posted entries are immutable: corrections go through reverseEntry. */
export async function updateEntry(
  ctx: Ctx,
  entryId: string,
  patch: { date?: string; ref?: string | null },
): Promise<Result<{ id: string }>> {
  const [entry] = await ctx.tx
    .select({ id: journalEntries.id, state: journalEntries.state })
    .from(journalEntries)
    .where(and(eq(journalEntries.companyId, ctx.companyId), eq(journalEntries.id, entryId)));
  if (!entry) return err('NOT_FOUND', 'ENTRY_NOT_FOUND');
  if (entry.state === 'posted') return err('POSTED_IMMUTABLE', 'ENTRY_IS_POSTED');

  await ctx.tx
    .update(journalEntries)
    .set({ date: patch.date, ref: patch.ref, updatedAt: sql`now()` })
    .where(eq(journalEntries.id, entry.id));
  await audit(ctx, { entity: 'accounting.entry', recordId: entry.id, action: 'update', after: patch });
  return ok({ id: entry.id });
}

export type EntryRow = {
  id: string;
  number: string;
  date: string;
  ref: string | null;
  state: string;
  journalLabel: string;
};

export async function listEntries(ctx: Ctx, query: ListQuery): Promise<ListResult<EntryRow>> {
  const term = query.q?.trim();
  const where = and(
    eq(journalEntries.companyId, ctx.companyId),
    term ? or(ilike(journalEntries.number, `%${term}%`), ilike(journalEntries.ref, `%${term}%`)) : undefined,
  );
  const [countRow] = await ctx.tx
    .select({ total: count() })
    .from(journalEntries)
    .where(where);
  const rows = await ctx.tx
    .select({
      id: journalEntries.id,
      number: journalEntries.number,
      date: journalEntries.date,
      ref: journalEntries.ref,
      state: journalEntries.state,
      journalLabel: journals.name,
    })
    .from(journalEntries)
    .innerJoin(journals, eq(journals.id, journalEntries.journalId))
    .where(where)
    .orderBy(desc(journalEntries.date), desc(journalEntries.number))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  return { rows, total: Number(countRow?.total ?? 0), page: query.page, pageSize: query.pageSize };
}

export async function getEntry(ctx: Ctx, entryId: string) {
  const [entry] = await ctx.tx
    .select({
      entry: journalEntries,
      journalCode: journals.code,
      journalName: journals.name,
    })
    .from(journalEntries)
    .innerJoin(journals, eq(journals.id, journalEntries.journalId))
    .where(and(eq(journalEntries.companyId, ctx.companyId), eq(journalEntries.id, entryId)));
  if (!entry) return err('NOT_FOUND', 'ENTRY_NOT_FOUND');

  const lines = await ctx.tx
    .select({
      id: journalLines.id,
      accountCode: accounts.code,
      accountName: accounts.name,
      partnerName: partners.displayName,
      label: journalLines.label,
      debitCents: journalLines.debitCents,
      creditCents: journalLines.creditCents,
    })
    .from(journalLines)
    .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
    .leftJoin(partners, eq(partners.id, journalLines.partnerId))
    .where(and(eq(journalLines.companyId, ctx.companyId), eq(journalLines.entryId, entryId)))
    .orderBy(journalLines.id);

  return ok({ entry: entry.entry, journalCode: entry.journalCode, journalName: entry.journalName, lines });
}
