// Manual entries: draft → posted. Drafts can be edited and deleted and may be unbalanced. Posting checks the balance,
// the period lock and archived accounts, then assigns the gap-free number. Posted entries are never edited (see reverseEntry).
import { randomUUID } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { audit } from '@/core/audit';
import { err, ok, type Result } from '@/core/result';
import { nextNumber } from '@/core/sequences';
import { accounts, journalEntries, journalLines, journals } from '../schema';
import { ensureDefaults } from './chart';
import { checkBalanced, type DraftLine } from './posting';
import { assertPeriodOpen } from './period';

export interface DraftInput {
  journalCode: string;
  date: string;
  ref?: string | null;
  lines: DraftLine[];
}

/** Resolves codes to account ids. Reports unknown and archived codes. */
async function resolveAccounts(ctx: Ctx, codes: string[]) {
  const unique = [...new Set(codes)];
  const rows = await ctx.tx
    .select({ id: accounts.id, code: accounts.code, archived: accounts.archived })
    .from(accounts)
    .where(and(eq(accounts.companyId, ctx.companyId), inArray(accounts.code, unique)));
  const byCode = new Map(rows.map((r) => [r.code, r.id]));
  return {
    byCode,
    missing: unique.filter((c) => !byCode.has(c)),
    archived: rows.filter((r) => r.archived).map((r) => r.code),
  };
}

async function writeLines(ctx: Ctx, entryId: string, lines: readonly DraftLine[], byCode: Map<string, string>): Promise<void> {
  await ctx.tx.insert(journalLines).values(
    lines.map((l) => ({
      companyId: ctx.companyId,
      entryId,
      accountId: byCode.get(l.accountCode)!,
      partnerId: l.partnerId ?? null,
      label: l.label ?? null,
      debitCents: l.debitCents,
      creditCents: l.creditCents,
      createdBy: ctx.userId,
    })),
  );
}

async function journalByCode(ctx: Ctx, code: string) {
  await ensureDefaults(ctx);
  const [journal] = await ctx.tx
    .select()
    .from(journals)
    .where(and(eq(journals.companyId, ctx.companyId), eq(journals.code, code)));
  return journal ?? null;
}

/** Creates a draft. Lines may be unbalanced until posting. Accounts must exist and must not be archived. */
export async function createDraftEntry(ctx: Ctx, input: DraftInput): Promise<Result<{ id: string }>> {
  const journal = await journalByCode(ctx, input.journalCode);
  if (!journal) return err('NOT_FOUND', 'JOURNAL_NOT_FOUND');
  const acc = await resolveAccounts(ctx, input.lines.map((l) => l.accountCode));
  if (acc.missing.length > 0) return err('NOT_FOUND', 'ACCOUNT_NOT_FOUND', { codes: acc.missing });
  if (acc.archived.length > 0) return err('CONFLICT', 'ACCOUNT_ARCHIVED', { codes: acc.archived });

  const [entry] = await ctx.tx
    .insert(journalEntries)
    .values({
      companyId: ctx.companyId,
      // Placeholder until posting, when nextNumber assigns the gap-free number.
      number: `DRAFT-${randomUUID().slice(0, 8)}`,
      journalId: journal.id,
      date: input.date,
      ref: input.ref ?? null,
      state: 'draft',
      createdBy: ctx.userId,
    })
    .returning({ id: journalEntries.id });
  if (!entry) return err('INTERNAL', 'ENTRY_INSERT_FAILED');
  await writeLines(ctx, entry.id, input.lines, acc.byCode);
  await audit(ctx, { entity: 'accounting.entry', recordId: entry.id, action: 'create', after: { state: 'draft' } });
  return ok({ id: entry.id });
}

async function loadDraft(ctx: Ctx, entryId: string) {
  const [entry] = await ctx.tx
    .select({ id: journalEntries.id, state: journalEntries.state, journalId: journalEntries.journalId, date: journalEntries.date })
    .from(journalEntries)
    .where(and(eq(journalEntries.companyId, ctx.companyId), eq(journalEntries.id, entryId)));
  if (!entry) return err('NOT_FOUND', 'ENTRY_NOT_FOUND');
  if (entry.state !== 'draft') return err('POSTED_IMMUTABLE', 'ENTRY_IS_POSTED');
  return ok(entry);
}

/** Replaces the header and lines of a draft. Refused once posted. */
export async function updateDraftEntry(ctx: Ctx, entryId: string, input: DraftInput): Promise<Result<{ id: string }>> {
  const draft = await loadDraft(ctx, entryId);
  if (!draft.ok) return draft;
  const journal = await journalByCode(ctx, input.journalCode);
  if (!journal) return err('NOT_FOUND', 'JOURNAL_NOT_FOUND');
  const acc = await resolveAccounts(ctx, input.lines.map((l) => l.accountCode));
  if (acc.missing.length > 0) return err('NOT_FOUND', 'ACCOUNT_NOT_FOUND', { codes: acc.missing });
  if (acc.archived.length > 0) return err('CONFLICT', 'ACCOUNT_ARCHIVED', { codes: acc.archived });

  await ctx.tx.delete(journalLines).where(and(eq(journalLines.companyId, ctx.companyId), eq(journalLines.entryId, entryId)));
  await ctx.tx
    .update(journalEntries)
    .set({ journalId: journal.id, date: input.date, ref: input.ref ?? null, updatedAt: sql`now()` })
    .where(eq(journalEntries.id, entryId));
  await writeLines(ctx, entryId, input.lines, acc.byCode);
  await audit(ctx, { entity: 'accounting.entry', recordId: entryId, action: 'update' });
  return ok({ id: entryId });
}

/** Posts a draft: checks the balance and the period lock, then numbers it and marks it posted. */
export async function postDraftEntry(ctx: Ctx, entryId: string): Promise<Result<{ id: string; number: string }>> {
  const draft = await loadDraft(ctx, entryId);
  if (!draft.ok) return draft;

  const lines = await ctx.tx
    .select({
      code: accounts.code,
      archived: accounts.archived,
      partnerId: journalLines.partnerId,
      label: journalLines.label,
      debitCents: journalLines.debitCents,
      creditCents: journalLines.creditCents,
    })
    .from(journalLines)
    .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
    .where(and(eq(journalLines.companyId, ctx.companyId), eq(journalLines.entryId, entryId)));
  const draftLines: DraftLine[] = lines.map((l) => ({
    accountCode: l.code,
    partnerId: l.partnerId,
    label: l.label,
    debitCents: l.debitCents,
    creditCents: l.creditCents,
  }));
  const balance = checkBalanced(draftLines);
  if (!balance.ok) return balance;
  if (lines.some((l) => l.archived)) return err('CONFLICT', 'ACCOUNT_ARCHIVED');

  const period = await assertPeriodOpen(ctx, draft.value.date);
  if (!period.ok) return period;

  const [journal] = await ctx.tx.select({ code: journals.code }).from(journals).where(eq(journals.id, draft.value.journalId));
  if (!journal) return err('NOT_FOUND', 'JOURNAL_NOT_FOUND');
  const number = await nextNumber(ctx, `accounting.entry.${journal.code}`, { prefix: `${journal.code}/{YYYY}/`, padding: 5 });

  await ctx.tx
    .update(journalEntries)
    .set({ number, state: 'posted', updatedAt: sql`now()` })
    .where(eq(journalEntries.id, entryId));
  await audit(ctx, { entity: 'accounting.entry', recordId: entryId, action: 'post', after: { number } });
  return ok({ id: entryId, number });
}

/** Deletes a draft. Posted entries cannot be deleted; they are reversed instead. */
export async function deleteDraftEntry(ctx: Ctx, entryId: string): Promise<Result<{ id: string }>> {
  const draft = await loadDraft(ctx, entryId);
  if (!draft.ok) return draft;
  await ctx.tx.delete(journalLines).where(and(eq(journalLines.companyId, ctx.companyId), eq(journalLines.entryId, entryId)));
  await ctx.tx.delete(journalEntries).where(and(eq(journalEntries.companyId, ctx.companyId), eq(journalEntries.id, entryId)));
  await audit(ctx, { entity: 'accounting.entry', recordId: entryId, action: 'delete' });
  return ok({ id: entryId });
}
