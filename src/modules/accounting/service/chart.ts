// SCF chart of accounts and journal seeds, plus list queries. Seeds are idempotent.
import { and, asc, count, eq, ilike, or } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import type { ListQuery, ListResult } from '@/core/entities/types';
import { accounts, journals, type Account, type Journal } from '../schema';

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface AccountSeed {
  code: string;
  name: string;
  accountClass: number;
  type: AccountType;
  reconcilable: boolean;
  // Every seeded account needs accountant review before use in filings.
  verify: '⚠ needs accountant verification';
}

const VERIFY = '⚠ needs accountant verification' as const;

// Main SCF accounts used by the posting rules. ⚠ Needs accountant verification.
export const SCF_CHART_SEED: readonly AccountSeed[] = [
  { code: '411', name: 'Clients', accountClass: 4, type: 'asset', reconcilable: true, verify: VERIFY },
  { code: '401', name: 'Fournisseurs', accountClass: 4, type: 'liability', reconcilable: true, verify: VERIFY },
  { code: '4457', name: 'TVA collectée', accountClass: 4, type: 'liability', reconcilable: false, verify: VERIFY },
  { code: '4456', name: 'TVA déductible', accountClass: 4, type: 'asset', reconcilable: false, verify: VERIFY },
  { code: '700', name: 'Ventes de marchandises', accountClass: 7, type: 'income', reconcilable: false, verify: VERIFY },
  { code: '600', name: 'Achats de marchandises', accountClass: 6, type: 'expense', reconcilable: false, verify: VERIFY },
  // Perpetual inventory (inventory.move.posted): stock at cost, and goods received but not yet billed.
  { code: '30', name: 'Stocks de marchandises', accountClass: 3, type: 'asset', reconcilable: false, verify: VERIFY },
  { code: '380', name: 'Achats de marchandises stockés (réceptions)', accountClass: 3, type: 'liability', reconcilable: false, verify: VERIFY },
  { code: '512', name: 'Banque', accountClass: 5, type: 'asset', reconcilable: true, verify: VERIFY },
  { code: '53', name: 'Caisse', accountClass: 5, type: 'asset', reconcilable: true, verify: VERIFY },
  { code: '445', name: 'Taxes (droit de timbre)', accountClass: 4, type: 'liability', reconcilable: false, verify: VERIFY },
  // ⚠ Added for credit sales: the markup (majoration) on instalment contracts. Confirm with the accountant
  // whether 708 (produits annexes) or 706 (services) is the right class for it.
  { code: '708', name: 'Produits annexes (majoration vente à crédit)', accountClass: 7, type: 'income', reconcilable: false, verify: VERIFY },
];

export const JOURNAL_SEED: readonly { code: string; name: string; type: Journal['type'] }[] = [
  { code: 'VT', name: 'Ventes', type: 'sale' },
  { code: 'AC', name: 'Achats', type: 'purchase' },
  { code: 'CA', name: 'Caisse', type: 'cash' },
  { code: 'BQ', name: 'Banque', type: 'bank' },
  { code: 'OD', name: 'Opérations diverses', type: 'general' },
];

/** Inserts the SCF seed for this company where missing. Safe to call on every request. */
export async function ensureChart(ctx: Ctx): Promise<void> {
  await ctx.tx
    .insert(accounts)
    .values(
      SCF_CHART_SEED.map((a) => ({
        companyId: ctx.companyId,
        code: a.code,
        name: a.name,
        accountClass: a.accountClass,
        type: a.type,
        reconcilable: a.reconcilable,
        createdBy: ctx.userId,
      })),
    )
    .onConflictDoNothing({ target: [accounts.companyId, accounts.code] });
}

/** Inserts the standard journals for this company where missing. */
export async function ensureJournals(ctx: Ctx): Promise<void> {
  await ctx.tx
    .insert(journals)
    .values(
      JOURNAL_SEED.map((j) => ({ companyId: ctx.companyId, code: j.code, name: j.name, type: j.type, createdBy: ctx.userId })),
    )
    .onConflictDoNothing({ target: [journals.companyId, journals.code] });
}

/** Seeds both chart and journals. Called from the accounting pages and event handlers. */
export async function ensureDefaults(ctx: Ctx): Promise<void> {
  await ensureChart(ctx);
  await ensureJournals(ctx);
}

export async function listAccounts(ctx: Ctx, query: ListQuery): Promise<ListResult<Account>> {
  const term = query.q?.trim();
  const where = and(
    eq(accounts.companyId, ctx.companyId),
    term ? or(ilike(accounts.code, `%${term}%`), ilike(accounts.name, `%${term}%`)) : undefined,
  );
  const [countRow] = await ctx.tx.select({ total: count() }).from(accounts).where(where);
  const rows = await ctx.tx
    .select()
    .from(accounts)
    .where(where)
    .orderBy(asc(accounts.code))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  return { rows, total: Number(countRow?.total ?? 0), page: query.page, pageSize: query.pageSize };
}

export async function listJournals(ctx: Ctx): Promise<Journal[]> {
  return ctx.tx
    .select()
    .from(journals)
    .where(eq(journals.companyId, ctx.companyId))
    .orderBy(asc(journals.code));
}

