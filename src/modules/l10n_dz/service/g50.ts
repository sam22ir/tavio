// G50 monthly VAT declaration: computed from posted entries, saved as a draft, then validated (locks the month).
// ⚠ needs accountant verification. The figures are a draft for the accountant to check.
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { accounts, journalEntries, journalLines } from '@/modules/accounting/schema';
import { g50Declarations, type G50Declaration, type G50Figures } from '../schema';

const COLLECTED = '4457';
const DEDUCTIBLE = '4456';
const STAMP = '445';
/** Retenue à la source withheld from suppliers. Reported apart from VAT. ⚠ needs accountant verification */
const WITHHOLDING = '447';

export interface G50Summary {
  collectedCents: bigint;
  deductibleCents: bigint;
  netDueCents: bigint;
  stampCents: bigint;
  needsAccountantReview: true;
}

/** Collected − deductible. Stamp is the balance posted to 445 in the month. ⚠ draft only. */
export function g50Summary(collectedCents: bigint, deductibleCents: bigint, stampCents: bigint = BigInt(0)): G50Summary {
  return {
    collectedCents,
    deductibleCents,
    netDueCents: collectedCents - deductibleCents,
    stampCents,
    needsAccountantReview: true,
  };
}

export function periodBounds(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from, to: `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}` };
}

function validPeriod(year: number, month: number): boolean {
  return Number.isInteger(year) && year >= 2000 && year <= 2100 && Number.isInteger(month) && month >= 1 && month <= 12;
}

/** Sums posted lines on 4457, 4456, 445 and 447 for the month. */
export async function g50Draft(
  ctx: Ctx,
  year: number,
  month: number,
): Promise<{ period: { from: string; to: string }; withholdingCents: bigint } & G50Summary> {
  const period = periodBounds(year, month);
  const rows = await ctx.tx
    .select({
      code: accounts.code,
      debit: sql<string>`coalesce(sum(${journalLines.debitCents}), 0)::text`,
      credit: sql<string>`coalesce(sum(${journalLines.creditCents}), 0)::text`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
    .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
    .where(
      and(
        eq(journalLines.companyId, ctx.companyId),
        eq(journalEntries.state, 'posted'),
        inArray(accounts.code, [COLLECTED, DEDUCTIBLE, STAMP, WITHHOLDING]),
        sql`${journalEntries.date} >= ${period.from}`,
        sql`${journalEntries.date} <= ${period.to}`,
      ),
    )
    .groupBy(accounts.code);
  const byCode = new Map(rows.map((r) => [r.code, { debit: BigInt(r.debit), credit: BigInt(r.credit) }]));
  const collected = byCode.get(COLLECTED) ?? { debit: BigInt(0), credit: BigInt(0) };
  const deductible = byCode.get(DEDUCTIBLE) ?? { debit: BigInt(0), credit: BigInt(0) };
  const stamp = byCode.get(STAMP) ?? { debit: BigInt(0), credit: BigInt(0) };
  const withholding = byCode.get(WITHHOLDING) ?? { debit: BigInt(0), credit: BigInt(0) };
  return {
    period,
    ...g50Summary(collected.credit - collected.debit, deductible.debit - deductible.credit, stamp.credit - stamp.debit),
    withholdingCents: withholding.credit - withholding.debit,
  };
}

function toFigures(d: Awaited<ReturnType<typeof g50Draft>>): G50Figures {
  return {
    period: d.period,
    collectedCents: d.collectedCents.toString(),
    deductibleCents: d.deductibleCents.toString(),
    netDueCents: d.netDueCents.toString(),
    stampCents: d.stampCents.toString(),
    withholdingCents: d.withholdingCents.toString(),
    needsAccountantReview: true,
  };
}

export async function getG50Declaration(ctx: Ctx, year: number, month: number): Promise<G50Declaration | null> {
  const [row] = await ctx.tx
    .select()
    .from(g50Declarations)
    .where(and(eq(g50Declarations.companyId, ctx.companyId), eq(g50Declarations.year, year), eq(g50Declarations.month, month)))
    .limit(1);
  return row ?? null;
}

export async function listG50Declarations(ctx: Ctx, year: number): Promise<G50Declaration[]> {
  const perm = requirePerm(ctx, 'l10n_dz.g50.read');
  if (!perm.ok) return [];
  return ctx.tx
    .select()
    .from(g50Declarations)
    .where(and(eq(g50Declarations.companyId, ctx.companyId), eq(g50Declarations.year, year)))
    .orderBy(asc(g50Declarations.month));
}

/** Computes the month from posted entries and saves it as a draft. A validated month is refused. */
export async function prepareG50(ctx: Ctx, year: number, month: number): Promise<Result<G50Declaration>> {
  const perm = requirePerm(ctx, 'l10n_dz.g50.write');
  if (!perm.ok) return perm;
  if (!validPeriod(year, month)) return err('VALIDATION', 'invalid period', { messageKey: 'errors.validation' });

  const existing = await getG50Declaration(ctx, year, month);
  if (existing?.state === 'validated') return err('CONFLICT', 'declaration already validated', { messageKey: 'l10n.g50.already_validated' });

  const figures = toFigures(await g50Draft(ctx, year, month));
  const [row] = await ctx.tx
    .insert(g50Declarations)
    .values({ companyId: ctx.companyId, createdBy: ctx.userId, year, month, state: 'draft', figures })
    .onConflictDoUpdate({
      target: [g50Declarations.companyId, g50Declarations.year, g50Declarations.month],
      set: { figures, updatedAt: new Date() },
    })
    .returning();
  if (!row) return err('INTERNAL', 'insert returned no row');
  await audit(ctx, { entity: 'l10n_dz.g50', recordId: row.id, action: 'prepare', before: existing ?? null, after: row });
  return ok(row);
}

/** Recomputes and freezes the month. Validated months are locked for posting, cancelling and editing. */
export async function validateG50(ctx: Ctx, year: number, month: number): Promise<Result<G50Declaration>> {
  const perm = requirePerm(ctx, 'l10n_dz.g50.post');
  if (!perm.ok) return perm;
  if (!validPeriod(year, month)) return err('VALIDATION', 'invalid period', { messageKey: 'errors.validation' });

  const existing = await getG50Declaration(ctx, year, month);
  if (!existing) return err('NOT_FOUND', 'prepare the declaration before validating it', { messageKey: 'l10n.g50.not_prepared' });
  if (existing.state === 'validated') return err('CONFLICT', 'declaration already validated', { messageKey: 'l10n.g50.already_validated' });

  const figures = toFigures(await g50Draft(ctx, year, month));
  const now = new Date();
  const [row] = await ctx.tx
    .update(g50Declarations)
    .set({ state: 'validated', figures, validatedBy: ctx.userId, validatedAt: now, updatedAt: now })
    .where(and(eq(g50Declarations.id, existing.id), eq(g50Declarations.state, 'draft')))
    .returning();
  if (!row) return err('CONFLICT', 'declaration already validated', { messageKey: 'l10n.g50.already_validated' });
  await audit(ctx, { entity: 'l10n_dz.g50', recordId: row.id, action: 'validate', before: existing, after: row });
  return ok(row);
}

/**
 * Period lock. Returns POSTED_IMMUTABLE when the month of `date` has a validated G50.
 * Called by invoicing before posting, cancelling or editing a document dated in that month.
 */
export async function assertPeriodOpen(ctx: Ctx, date: string): Promise<Result<void>> {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const [locked] = await ctx.tx
    .select({ id: g50Declarations.id })
    .from(g50Declarations)
    .where(
      and(
        eq(g50Declarations.companyId, ctx.companyId),
        eq(g50Declarations.year, year),
        eq(g50Declarations.month, month),
        eq(g50Declarations.state, 'validated'),
      ),
    )
    .limit(1);
  if (!locked) return ok(undefined);
  const label = `${year}-${String(month).padStart(2, '0')}`;
  return err('POSTED_IMMUTABLE', `period ${label} is closed by a validated G50 declaration`, { messageKey: 'l10n.g50.period_locked' });
}
