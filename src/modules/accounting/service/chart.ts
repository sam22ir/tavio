// SCF chart of accounts and journal seeds, account and journal maintenance, list queries. Seeds are idempotent.
import { and, asc, count, eq, ilike, or, sql } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { audit } from '@/core/audit';
import { err, ok, type Result } from '@/core/result';
import type { ListQuery, ListResult } from '@/core/entities/types';
import { accounts, journalLines, journals, type Account, type Journal } from '../schema';

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export type JournalType = Journal['type'];

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

// Compact rows: [code, name, type, reconcilable?]. The class is the first digit of the code.
// ⚠ Needs accountant verification: names, types and the choice of sub-accounts, especially mixed accounts (44, 45, 47).
type Row = readonly [string, string, AccountType, boolean?];
const CHART_ROWS: readonly Row[] = [
  // Classe 1: capitaux propres et passifs non courants
  ['10', 'Capital', 'equity'],
  ['101', 'Capital souscrit', 'equity'],
  ['105', 'Écarts de réévaluation', 'equity'],
  ['106', 'Réserves', 'equity'],
  ['108', 'Compte de l’exploitant', 'equity'],
  ['11', 'Report à nouveau', 'equity'],
  ['12', 'Résultat de l’exercice', 'equity'],
  ['13', 'Subventions d’investissement', 'equity'],
  ['15', 'Provisions pour risques et charges', 'liability'],
  ['16', 'Emprunts et dettes assimilées', 'liability'],
  ['161', 'Emprunts', 'liability'],
  ['164', 'Emprunts auprès des établissements de crédit', 'liability'],
  ['17', 'Dettes rattachées à des participations', 'liability'],
  ['181', 'Comptes de liaison des établissements', 'liability'],
  // Classe 2: immobilisations
  ['20', 'Immobilisations incorporelles', 'asset'],
  ['201', 'Frais d’établissement', 'asset'],
  ['205', 'Concessions, brevets, logiciels', 'asset'],
  ['21', 'Immobilisations corporelles', 'asset'],
  ['211', 'Terrains', 'asset'],
  ['213', 'Constructions', 'asset'],
  ['215', 'Installations techniques, matériel et outillage', 'asset'],
  ['218', 'Autres immobilisations corporelles', 'asset'],
  ['23', 'Immobilisations en cours', 'asset'],
  ['26', 'Participations', 'asset'],
  ['27', 'Autres immobilisations financières', 'asset'],
  ['280', 'Amortissements des immobilisations incorporelles', 'asset'],
  ['281', 'Amortissements des immobilisations corporelles', 'asset'],
  ['290', 'Provisions pour dépréciation des immobilisations incorporelles', 'asset'],
  ['291', 'Provisions pour dépréciation des immobilisations corporelles', 'asset'],
  // Classe 3: stocks et en-cours
  ['30', 'Stocks de marchandises', 'asset'],
  ['31', 'Matières premières', 'asset'],
  ['32', 'Autres approvisionnements', 'asset'],
  ['33', 'En-cours de production', 'asset'],
  ['35', 'Stocks de produits', 'asset'],
  ['380', 'Achats de marchandises stockés (réceptions)', 'liability'],
  ['381', 'Achats de matières premières stockés (réceptions)', 'liability'],
  ['390', 'Provisions pour dépréciation des stocks', 'asset'],
  // Classe 4: comptes de tiers
  ['400', 'Fournisseurs et comptes rattachés', 'liability'],
  ['401', 'Fournisseurs', 'liability', true],
  ['402', 'Fournisseurs d’immobilisations', 'liability'],
  ['403', 'Fournisseurs, effets à payer', 'liability'],
  ['411', 'Clients', 'asset', true],
  ['412', 'Clients, effets à recevoir', 'asset'],
  ['416', 'Clients douteux ou litigieux', 'asset'],
  ['418', 'Clients, produits à recevoir', 'asset'],
  ['421', 'Personnel, rémunérations dues', 'liability'],
  ['428', 'Personnel, charges à payer', 'liability'],
  ['431', 'Sécurité sociale (CNAS)', 'liability'],
  ['437', 'Autres organismes sociaux', 'liability'],
  ['441', 'État, impôts sur les bénéfices', 'liability'],
  ['4456', 'TVA déductible', 'asset'],
  ['4457', 'TVA collectée', 'liability'],
  ['4458', 'TVA à régulariser ou en attente', 'asset'],
  ['445', 'Taxes (droit de timbre)', 'liability'],
  ['455', 'Associés, compte courant', 'liability'],
  ['461', 'Débiteurs divers', 'asset'],
  ['467', 'Autres comptes débiteurs ou créditeurs', 'asset'],
  ['471', 'Comptes d’attente', 'asset'],
  ['481', 'Charges à répartir', 'asset'],
  ['487', 'Produits constatés d’avance', 'liability'],
  ['491', 'Provisions pour dépréciation des comptes clients', 'asset'],
  // Classe 5: trésorerie
  ['501', 'Valeurs mobilières de placement', 'asset'],
  ['512', 'Banque', 'asset', true],
  ['5121', 'Banque, compte courant', 'asset', true],
  ['519', 'Concours bancaires courants', 'liability'],
  ['53', 'Caisse', 'asset', true],
  ['531', 'Caisse principale', 'asset', true],
  ['541', 'Régies d’avances et accréditifs', 'asset'],
  ['58', 'Virements internes', 'asset'],
  // Classe 6: charges
  ['600', 'Achats de marchandises', 'expense'],
  ['601', 'Achats de matières premières', 'expense'],
  ['602', 'Achats d’autres approvisionnements', 'expense'],
  ['603', 'Variations des stocks', 'expense'],
  ['611', 'Sous-traitance générale', 'expense'],
  ['613', 'Locations', 'expense'],
  ['615', 'Entretien et réparations', 'expense'],
  ['616', 'Primes d’assurance', 'expense'],
  ['618', 'Divers services extérieurs', 'expense'],
  ['622', 'Honoraires', 'expense'],
  ['623', 'Publicité', 'expense'],
  ['624', 'Transports', 'expense'],
  ['625', 'Déplacements, missions et réceptions', 'expense'],
  ['626', 'Frais postaux et télécommunications', 'expense'],
  ['627', 'Services bancaires', 'expense'],
  ['628', 'Divers', 'expense'],
  ['635', 'Impôts et taxes (droits d’enregistrement, timbre)', 'expense'],
  ['641', 'Rémunérations du personnel', 'expense'],
  ['645', 'Charges de sécurité sociale (CNAS)', 'expense'],
  ['648', 'Autres charges sociales', 'expense'],
  ['651', 'Redevances et droits similaires', 'expense'],
  ['654', 'Pertes sur créances irrécouvrables', 'expense'],
  ['658', 'Charges diverses', 'expense'],
  ['661', 'Charges d’intérêts', 'expense'],
  ['664', 'Pertes de change', 'expense'],
  ['667', 'Escomptes accordés', 'expense'],
  ['671', 'Charges exceptionnelles', 'expense'],
  ['681', 'Dotations aux amortissements', 'expense'],
  ['686', 'Dotations aux provisions financières', 'expense'],
  ['692', 'Impôts sur le résultat', 'expense'],
  // Classe 7: produits
  ['700', 'Ventes de marchandises', 'income'],
  ['701', 'Ventes de produits finis', 'income'],
  ['706', 'Prestations de services', 'income'],
  ['708', 'Produits annexes (majoration vente à crédit)', 'income'],
  ['713', 'Variation des stocks (produits)', 'income'],
  ['721', 'Production immobilisée', 'income'],
  ['741', 'Subventions d’exploitation', 'income'],
  ['751', 'Redevances et droits similaires (produits)', 'income'],
  ['758', 'Produits divers', 'income'],
  ['761', 'Produits de participations', 'income'],
  ['764', 'Gains de change', 'income'],
  ['767', 'Escomptes obtenus', 'income'],
  ['771', 'Produits exceptionnels', 'income'],
  ['781', 'Reprises sur amortissements', 'income'],
  ['786', 'Reprises sur provisions financières', 'income'],
  ['791', 'Transferts de charges', 'income'],
];

export function accountClassOf(code: string): number {
  return Number(code[0]);
}

export function parentCodeOf(code: string): string {
  return code.length > 2 ? code.slice(0, 2) : code.slice(0, 1);
}

// SCF chart seed. ⚠ Needs accountant verification: names, types and the choice of sub-accounts.
// 708 is kept for the credit-sales markup; 380 and 30 are the perpetual inventory accounts (service/posting.ts).
export const SCF_CHART_SEED: readonly AccountSeed[] = CHART_ROWS.map(([code, name, type, reconcilable]) => ({
  code,
  name,
  accountClass: accountClassOf(code),
  type,
  reconcilable: reconcilable ?? false,
  verify: VERIFY,
}));

export const JOURNAL_SEED: readonly { code: string; name: string; type: JournalType }[] = [
  { code: 'VT', name: 'Ventes', type: 'sale' },
  { code: 'AC', name: 'Achats', type: 'purchase' },
  { code: 'CA', name: 'Caisse', type: 'cash' },
  { code: 'BQ', name: 'Banque', type: 'bank' },
  { code: 'OD', name: 'Opérations diverses', type: 'general' },
];

/** Opening-balances journal (à nouveaux). Created on the first closing if missing. */
export const OPENING_JOURNAL = { code: 'AN', name: 'À nouveaux', type: 'misc' } as const;

/** Inserts the SCF seed for this company where missing. Never updates or deletes existing accounts. */
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
        parentCode: parentCodeOf(a.code),
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

// ---- Maintenance: accounts and journals --------------------------------------------------------

const ACCOUNT_CODE = /^\d{2,8}$/;
const JOURNAL_CODE = /^[A-Z0-9]{1,6}$/;

export interface AccountInput {
  code: string;
  name: string;
  type: AccountType;
  reconcilable: boolean;
}

export interface AccountPatch {
  name?: string;
  type?: AccountType;
  reconcilable?: boolean;
}

/** True when the account has any journal line, posted or draft. */
export async function accountHasLines(ctx: Ctx, accountId: string): Promise<boolean> {
  const [row] = await ctx.tx
    .select({ n: count() })
    .from(journalLines)
    .where(and(eq(journalLines.companyId, ctx.companyId), eq(journalLines.accountId, accountId)));
  return Number(row?.n ?? 0) > 0;
}

/** Adds an account. The code must be unique for the company and is never changed afterwards. */
export async function createAccount(ctx: Ctx, input: AccountInput): Promise<Result<{ id: string }>> {
  if (!ACCOUNT_CODE.test(input.code)) return err('VALIDATION', 'ACCOUNT_CODE_INVALID');
  const [dup] = await ctx.tx
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.companyId, ctx.companyId), eq(accounts.code, input.code)));
  if (dup) return err('CONFLICT', 'ACCOUNT_CODE_TAKEN');
  const [row] = await ctx.tx
    .insert(accounts)
    .values({
      companyId: ctx.companyId,
      code: input.code,
      name: input.name,
      accountClass: accountClassOf(input.code),
      type: input.type,
      reconcilable: input.reconcilable,
      parentCode: parentCodeOf(input.code),
      createdBy: ctx.userId,
    })
    .returning({ id: accounts.id });
  if (!row) return err('INTERNAL', 'ACCOUNT_INSERT_FAILED');
  await audit(ctx, { entity: 'accounting.account', recordId: row.id, action: 'create', after: { code: input.code } });
  return ok({ id: row.id });
}

/** Edits an account. Changing the type is refused once the account has journal lines, since reports depend on it. */
export async function updateAccount(ctx: Ctx, accountId: string, patch: AccountPatch): Promise<Result<{ id: string }>> {
  const [acc] = await ctx.tx
    .select()
    .from(accounts)
    .where(and(eq(accounts.companyId, ctx.companyId), eq(accounts.id, accountId)));
  if (!acc) return err('NOT_FOUND', 'ACCOUNT_NOT_FOUND');
  if (patch.type && patch.type !== acc.type && (await accountHasLines(ctx, acc.id))) {
    return err('CONFLICT', 'ACCOUNT_TYPE_LOCKED_BY_ENTRIES');
  }
  await ctx.tx
    .update(accounts)
    .set({
      name: patch.name ?? acc.name,
      type: patch.type ?? acc.type,
      reconcilable: patch.reconcilable ?? acc.reconcilable,
      updatedAt: sql`now()`,
    })
    .where(eq(accounts.id, acc.id));
  await audit(ctx, { entity: 'accounting.account', recordId: acc.id, action: 'update', after: patch });
  return ok({ id: acc.id });
}

/** Archives an account. Refused when the account already has journal lines (posted or draft). */
export async function archiveAccount(ctx: Ctx, accountId: string): Promise<Result<{ id: string }>> {
  const [acc] = await ctx.tx
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.companyId, ctx.companyId), eq(accounts.id, accountId)));
  if (!acc) return err('NOT_FOUND', 'ACCOUNT_NOT_FOUND');
  if (await accountHasLines(ctx, acc.id)) return err('CONFLICT', 'ACCOUNT_HAS_ENTRIES');
  await ctx.tx.update(accounts).set({ archived: true, updatedAt: sql`now()` }).where(eq(accounts.id, acc.id));
  await audit(ctx, { entity: 'accounting.account', recordId: acc.id, action: 'archive' });
  return ok({ id: acc.id });
}

export interface JournalInput {
  code: string;
  name: string;
  type: JournalType;
}

export async function createJournal(ctx: Ctx, input: JournalInput): Promise<Result<{ id: string }>> {
  if (!JOURNAL_CODE.test(input.code)) return err('VALIDATION', 'JOURNAL_CODE_INVALID');
  const [dup] = await ctx.tx
    .select({ id: journals.id })
    .from(journals)
    .where(and(eq(journals.companyId, ctx.companyId), eq(journals.code, input.code)));
  if (dup) return err('CONFLICT', 'JOURNAL_CODE_TAKEN');
  const [row] = await ctx.tx
    .insert(journals)
    .values({ companyId: ctx.companyId, code: input.code, name: input.name, type: input.type, createdBy: ctx.userId })
    .returning({ id: journals.id });
  if (!row) return err('INTERNAL', 'JOURNAL_INSERT_FAILED');
  await audit(ctx, { entity: 'accounting.journal', recordId: row.id, action: 'create', after: { code: input.code } });
  return ok({ id: row.id });
}

/** Edits a journal's name and type. The code is fixed because entry numbers use it. */
export async function updateJournal(ctx: Ctx, journalId: string, patch: { name: string; type: JournalType }): Promise<Result<{ id: string }>> {
  const [j] = await ctx.tx
    .select({ id: journals.id })
    .from(journals)
    .where(and(eq(journals.companyId, ctx.companyId), eq(journals.id, journalId)));
  if (!j) return err('NOT_FOUND', 'JOURNAL_NOT_FOUND');
  await ctx.tx
    .update(journals)
    .set({ name: patch.name, type: patch.type, updatedAt: sql`now()` })
    .where(eq(journals.id, j.id));
  await audit(ctx, { entity: 'accounting.journal', recordId: j.id, action: 'update', after: patch });
  return ok({ id: j.id });
}
