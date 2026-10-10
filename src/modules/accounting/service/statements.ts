// SCF statements: bilan (actif / passif), TCR by nature, opening balances, grand livre, trial balance and partner aging.
// The SCF mappings below are the single source of truth for the layout. ⚠ Needs accountant verification.
import { and, asc, eq, lte, max, sql } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { ok } from '@/core/result';
import { partners } from '@/modules/contacts/schema';
import { accounts, journalEntries, journalLines } from '../schema';
import { addDays } from './fiscal';
import { accountTotals, generalLedger, type DateRange } from './reports';

export type AccountTypeName = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

// ---- Mappings: account prefix → statement line. Longest prefix wins. ⚠ Needs accountant verification. ----

export const BILAN_LINES = {
  ACT_INC: 'Immobilisations incorporelles',
  ACT_CORP: 'Immobilisations corporelles',
  ACT_FIN: 'Immobilisations financières',
  ACT_AMORT: 'Amortissements et provisions (à déduire)',
  ACT_STOCK: 'Stocks et en-cours',
  ACT_CREANCES: 'Créances et emplois assimilés',
  ACT_TRESO: 'Trésorerie et disponibilités',
  ACT_OTHER: 'Autres actifs',
  PAS_CAP: 'Capitaux propres (capital, réserves, reports)',
  PAS_RESULT: 'Résultat de l’exercice',
  PAS_DETTES_FIN: 'Dettes financières',
  PAS_FOURN: 'Fournisseurs et comptes rattachés',
  PAS_FISC: 'Impôts, taxes et dettes sociales',
  PAS_AUTRES: 'Autres passifs',
  PAS_OTHER: 'Autres passifs (non classés)',
} as const;
export type BilanLine = keyof typeof BILAN_LINES;

export const BILAN_SECTION: Record<BilanLine, 'actif' | 'passif'> = {
  ACT_INC: 'actif',
  ACT_CORP: 'actif',
  ACT_FIN: 'actif',
  ACT_AMORT: 'actif',
  ACT_STOCK: 'actif',
  ACT_CREANCES: 'actif',
  ACT_TRESO: 'actif',
  ACT_OTHER: 'actif',
  PAS_CAP: 'passif',
  PAS_RESULT: 'passif',
  PAS_DETTES_FIN: 'passif',
  PAS_FOURN: 'passif',
  PAS_FISC: 'passif',
  PAS_AUTRES: 'passif',
  PAS_OTHER: 'passif',
};

/** Account prefix → bilan line. Longest matching prefix wins. Accounts that match nothing fall back on their type. */
export const SCF_BILAN_MAP: readonly { prefix: string; line: BilanLine }[] = [
  { prefix: '20', line: 'ACT_INC' },
  { prefix: '21', line: 'ACT_CORP' },
  { prefix: '23', line: 'ACT_CORP' },
  { prefix: '26', line: 'ACT_FIN' },
  { prefix: '27', line: 'ACT_FIN' },
  { prefix: '280', line: 'ACT_AMORT' },
  { prefix: '281', line: 'ACT_AMORT' },
  { prefix: '290', line: 'ACT_AMORT' },
  { prefix: '291', line: 'ACT_AMORT' },
  { prefix: '3', line: 'ACT_STOCK' },
  { prefix: '380', line: 'PAS_FOURN' },
  { prefix: '381', line: 'PAS_FOURN' },
  { prefix: '390', line: 'ACT_AMORT' },
  { prefix: '40', line: 'PAS_FOURN' },
  { prefix: '41', line: 'ACT_CREANCES' },
  { prefix: '491', line: 'ACT_AMORT' },
  { prefix: '42', line: 'PAS_FISC' },
  { prefix: '43', line: 'PAS_FISC' },
  { prefix: '441', line: 'PAS_FISC' },
  { prefix: '4456', line: 'ACT_CREANCES' },
  { prefix: '4458', line: 'ACT_CREANCES' },
  { prefix: '4457', line: 'PAS_FISC' },
  { prefix: '44', line: 'PAS_FISC' },
  { prefix: '445', line: 'PAS_FISC' },
  { prefix: '455', line: 'PAS_AUTRES' },
  { prefix: '461', line: 'ACT_CREANCES' },
  { prefix: '467', line: 'ACT_CREANCES' },
  { prefix: '471', line: 'ACT_CREANCES' },
  { prefix: '481', line: 'ACT_CREANCES' },
  { prefix: '487', line: 'PAS_AUTRES' },
  { prefix: '10', line: 'PAS_CAP' },
  { prefix: '11', line: 'PAS_CAP' },
  { prefix: '13', line: 'PAS_CAP' },
  { prefix: '12', line: 'PAS_RESULT' },
  { prefix: '15', line: 'PAS_AUTRES' },
  { prefix: '16', line: 'PAS_DETTES_FIN' },
  { prefix: '17', line: 'PAS_DETTES_FIN' },
  { prefix: '181', line: 'PAS_AUTRES' },
  { prefix: '519', line: 'PAS_DETTES_FIN' },
  { prefix: '5', line: 'ACT_TRESO' },
];

export const TCR_LINES = {
  TCR_VENTES: { label: 'Ventes et produits annexes', side: 'produit' },
  TCR_VAR_STOCK_PROD: { label: 'Variation des stocks de produits', side: 'produit' },
  TCR_PROD_IMMO: { label: 'Production immobilisée', side: 'produit' },
  TCR_SUBV: { label: 'Subventions d’exploitation', side: 'produit' },
  TCR_AUTRES_PROD_OP: { label: 'Autres produits opérationnels', side: 'produit' },
  TCR_PROD_FIN: { label: 'Produits financiers', side: 'produit' },
  TCR_REPRISES: { label: 'Reprises sur pertes de valeur et provisions', side: 'produit' },
  TCR_PROD_EXC: { label: 'Produits exceptionnels', side: 'produit' },
  TCR_TRANSFERTS: { label: 'Transferts de charges', side: 'produit' },
  TCR_ACHATS: { label: 'Achats consommés', side: 'charge' },
  TCR_VAR_STOCK: { label: 'Variation des stocks (charges)', side: 'charge' },
  TCR_SERV_EXT: { label: 'Services extérieurs et autres consommations', side: 'charge' },
  TCR_IMPOTS: { label: 'Impôts, taxes et versements assimilés', side: 'charge' },
  TCR_PERSONNEL: { label: 'Charges de personnel', side: 'charge' },
  TCR_AUTRES_CHARGES_OP: { label: 'Autres charges opérationnelles', side: 'charge' },
  TCR_CHARGES_FIN: { label: 'Charges financières', side: 'charge' },
  TCR_CHARGES_EXC: { label: 'Charges exceptionnelles', side: 'charge' },
  TCR_DOTATIONS: { label: 'Dotations aux amortissements et provisions', side: 'charge' },
  TCR_IMPOTS_RES: { label: 'Impôts sur le résultat', side: 'charge' },
} as const;
export type TcrLine = keyof typeof TCR_LINES;

/** Account prefix → TCR line (by nature). Longest prefix wins. Class 6 and 7 accounts that match nothing fall back on type. */
export const SCF_TCR_MAP: readonly { prefix: string; line: TcrLine }[] = [
  { prefix: '70', line: 'TCR_VENTES' },
  { prefix: '713', line: 'TCR_VAR_STOCK_PROD' },
  { prefix: '721', line: 'TCR_PROD_IMMO' },
  { prefix: '741', line: 'TCR_SUBV' },
  { prefix: '75', line: 'TCR_AUTRES_PROD_OP' },
  { prefix: '76', line: 'TCR_PROD_FIN' },
  { prefix: '78', line: 'TCR_REPRISES' },
  { prefix: '77', line: 'TCR_PROD_EXC' },
  { prefix: '79', line: 'TCR_TRANSFERTS' },
  { prefix: '600', line: 'TCR_ACHATS' },
  { prefix: '601', line: 'TCR_ACHATS' },
  { prefix: '602', line: 'TCR_ACHATS' },
  { prefix: '603', line: 'TCR_VAR_STOCK' },
  { prefix: '61', line: 'TCR_SERV_EXT' },
  { prefix: '62', line: 'TCR_SERV_EXT' },
  { prefix: '63', line: 'TCR_IMPOTS' },
  { prefix: '64', line: 'TCR_PERSONNEL' },
  { prefix: '65', line: 'TCR_AUTRES_CHARGES_OP' },
  { prefix: '66', line: 'TCR_CHARGES_FIN' },
  { prefix: '67', line: 'TCR_CHARGES_EXC' },
  { prefix: '68', line: 'TCR_DOTATIONS' },
  { prefix: '692', line: 'TCR_IMPOTS_RES' },
];

/** Longest-prefix lookup over a mapping table. */
export function matchPrefix<T extends string>(code: string, map: readonly { prefix: string; line: T }[]): T | null {
  let best: { prefix: string; line: T } | null = null;
  for (const m of map) {
    if (code.startsWith(m.prefix) && (!best || m.prefix.length > best.prefix.length)) best = m;
  }
  return best?.line ?? null;
}

// ---- Pure statement builders ---------------------------------------------------------------------

export interface AccountNet {
  code: string;
  type: AccountTypeName;
  /** debit − credit over the period (or at the date for a bilan). */
  netCents: bigint;
}

export interface StatementLine<K extends string> {
  key: K;
  label: string;
  amountCents: bigint;
}

export interface Bilan {
  actif: StatementLine<BilanLine>[];
  passif: StatementLine<BilanLine>[];
  totalActifCents: bigint;
  totalPassifCents: bigint;
  balanced: boolean;
}

/**
 * Bilan from account nets. Actif amounts are debit − credit (amortisation lines come out negative).
 * Passif amounts are credit − debit. Result = −Σ net of classes 6, 7 and 12 (the result account).
 * Balanced whenever the entries balance, because every account lands on exactly one side.
 */
export function buildBilan(accountsNet: readonly AccountNet[]): Bilan {
  const sums = new Map<BilanLine, bigint>();
  for (const k of Object.keys(BILAN_LINES) as BilanLine[]) sums.set(k, BigInt(0));
  const add = (k: BilanLine, v: bigint) => sums.set(k, (sums.get(k) ?? BigInt(0)) + v);

  for (const a of accountsNet) {
    const cls = Number(a.code[0]);
    const mapped = matchPrefix(a.code, SCF_BILAN_MAP);
    // Income and expense accounts (classes 6 and 7) are part of the result until they are closed into account 12.
    if (cls === 6 || cls === 7 || a.type === 'income' || a.type === 'expense') {
      add('PAS_RESULT', -a.netCents);
      continue;
    }
    if (mapped) {
      if (BILAN_SECTION[mapped] === 'actif') add(mapped, a.netCents);
      else add(mapped, -a.netCents);
      continue;
    }
    if (a.type === 'asset') add('ACT_OTHER', a.netCents);
    else add('PAS_OTHER', -a.netCents);
  }

  const toLines = (section: 'actif' | 'passif') =>
    (Object.keys(BILAN_LINES) as BilanLine[])
      .filter((k) => BILAN_SECTION[k] === section)
      .map((k) => ({ key: k, label: BILAN_LINES[k], amountCents: sums.get(k) ?? BigInt(0) }));
  const actif = toLines('actif');
  const passif = toLines('passif');
  const totalActifCents = actif.reduce((s, l) => s + l.amountCents, BigInt(0));
  const totalPassifCents = passif.reduce((s, l) => s + l.amountCents, BigInt(0));
  return { actif, passif, totalActifCents, totalPassifCents, balanced: totalActifCents === totalPassifCents };
}

export interface Tcr {
  produits: StatementLine<TcrLine>[];
  charges: StatementLine<TcrLine>[];
  totalProduitsCents: bigint;
  totalChargesCents: bigint;
  resultCents: bigint;
}

/** TCR by nature from period movements. Produits are credit − debit, charges are debit − credit. */
export function buildTcr(accountsNet: readonly AccountNet[]): Tcr {
  const sums = new Map<TcrLine, bigint>();
  for (const k of Object.keys(TCR_LINES) as TcrLine[]) sums.set(k, BigInt(0));
  for (const a of accountsNet) {
    const cls = Number(a.code[0]);
    if (cls !== 6 && cls !== 7) continue;
    const mapped = matchPrefix(a.code, SCF_TCR_MAP);
    const fallback: TcrLine = cls === 7 ? 'TCR_AUTRES_PROD_OP' : 'TCR_AUTRES_CHARGES_OP';
    const key = mapped ?? fallback;
    const side = TCR_LINES[key].side;
    sums.set(key, (sums.get(key) ?? BigInt(0)) + (side === 'produit' ? -a.netCents : a.netCents));
  }
  const keys = Object.keys(TCR_LINES) as TcrLine[];
  const produits = keys
    .filter((k) => TCR_LINES[k].side === 'produit')
    .map((k) => ({ key: k, label: TCR_LINES[k].label, amountCents: sums.get(k) ?? BigInt(0) }));
  const charges = keys
    .filter((k) => TCR_LINES[k].side === 'charge')
    .map((k) => ({ key: k, label: TCR_LINES[k].label, amountCents: sums.get(k) ?? BigInt(0) }));
  const totalProduitsCents = produits.reduce((s, l) => s + l.amountCents, BigInt(0));
  const totalChargesCents = charges.reduce((s, l) => s + l.amountCents, BigInt(0));
  return { produits, charges, totalProduitsCents, totalChargesCents, resultCents: totalProduitsCents - totalChargesCents };
}

// ---- Partner aging ---------------------------------------------------------------------------------

export const AGING_BUCKETS = ['0-30', '31-60', '61-90', '90+'] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export interface AgingItem {
  date: string;
  debitCents: bigint;
  creditCents: bigint;
}

export interface AgingResult {
  buckets: Record<AgingBucket, bigint>;
  totalCents: bigint;
  /** Credits not matched to any debit (advances). Not part of the buckets. */
  unallocatedCents: bigint;
}

const DAY_MS = 86_400_000;

/** Days between two YYYY-MM-DD dates (asOf − date). */
export function ageInDays(date: string, asOf: string): number {
  return Math.round((Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / DAY_MS);
}

export function bucketOf(days: number): AgingBucket {
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

/**
 * Ages open receivable items for one partner. Credits settle the oldest debits first (FIFO).
 * Each remaining open debit is placed in a bucket by its age on asOf. Items dated after asOf are ignored.
 */
export function agePartnerItems(items: readonly AgingItem[], asOf: string): AgingResult {
  const buckets: Record<AgingBucket, bigint> = { '0-30': BigInt(0), '31-60': BigInt(0), '61-90': BigInt(0), '90+': BigInt(0) };
  const sorted = items.filter((i) => i.date <= asOf).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const open: { date: string; cents: bigint }[] = [];
  let credit = BigInt(0);
  for (const i of sorted) {
    if (i.debitCents > BigInt(0)) open.push({ date: i.date, cents: i.debitCents });
    credit += i.creditCents;
  }
  for (const d of open) {
    if (credit <= BigInt(0)) break;
    const used = credit < d.cents ? credit : d.cents;
    d.cents -= used;
    credit -= used;
  }
  const unallocated = credit;
  let total = BigInt(0);
  for (const d of open) {
    if (d.cents <= BigInt(0)) continue;
    buckets[bucketOf(ageInDays(d.date, asOf))] += d.cents;
    total += d.cents;
  }
  return { buckets, totalCents: total, unallocatedCents: unallocated };
}

export interface PartnerAgingRow extends AgingResult {
  partnerId: string | null;
  partnerName: string;
}

/** Partner aging on a receivable (411) or payable (401) account as of a date. Positive buckets mean money owed. */
export async function partnerAging(ctx: Ctx, asOf: string, accountCode: '411' | '401' = '411'): Promise<PartnerAgingRow[]> {
  const rows = await ctx.tx
    .select({
      partnerId: journalLines.partnerId,
      partnerName: partners.displayName,
      date: journalEntries.date,
      debit: journalLines.debitCents,
      credit: journalLines.creditCents,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
    .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
    .innerJoin(partners, eq(partners.id, journalLines.partnerId))
    .where(
      and(
        eq(journalLines.companyId, ctx.companyId),
        eq(accounts.code, accountCode),
        eq(journalEntries.state, 'posted'),
        lte(journalEntries.date, asOf),
      ),
    )
    .orderBy(asc(journalEntries.date));

  const byPartner = new Map<string, { name: string; items: AgingItem[] }>();
  for (const r of rows) {
    const key = r.partnerId ?? '';
    const cur = byPartner.get(key) ?? { name: r.partnerName, items: [] };
    cur.items.push({ date: r.date, debitCents: r.debit, creditCents: r.credit });
    byPartner.set(key, cur);
  }
  const out: PartnerAgingRow[] = [];
  for (const [key, v] of byPartner) {
    const res = agePartnerItems(v.items, asOf);
    if (res.totalCents === BigInt(0) && res.unallocatedCents === BigInt(0)) continue;
    out.push({ partnerId: key || null, partnerName: v.name, ...res });
  }
  return out.sort((a, b) => a.partnerName.localeCompare(b.partnerName));
}

// ---- Opening balances, grand livre and trial balance with carry-forward -------------------------

/**
 * Date from which the carry-forward starts: the latest opening (AN) entry dated before `from`.
 * Balances before `from` are the AN entry plus the movements after it. Without an AN entry, all history counts.
 */
export async function carryForwardAnchor(ctx: Ctx, from: string): Promise<string | null> {
  const [row] = await ctx.tx
    .select({ d: max(journalEntries.date) })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.companyId, ctx.companyId),
        eq(journalEntries.sourceEntity, 'accounting.opening'),
        eq(journalEntries.state, 'posted'),
        sql`${journalEntries.date} < ${from}`,
      ),
    );
  return row?.d ?? null;
}

/** Opening balance per account on `from` (debit − credit), carried forward from the AN entry when there is one. */
export async function openingNets(ctx: Ctx, from: string): Promise<Map<string, bigint>> {
  const anchor = await carryForwardAnchor(ctx, from);
  const totals = await accountTotals(ctx, { from: anchor ?? undefined, to: addDays(from, -1) });
  return new Map(totals.map((t) => [t.code, t.debitCents - t.creditCents]));
}

/** Trial balance with opening balances and a date range: opening net, period movements and closing net per account. */
export async function trialBalanceWithOpening(ctx: Ctx, range: DateRange) {
  const opening = range.from ? await openingNets(ctx, range.from) : new Map<string, bigint>();
  const movements = await accountTotals(ctx, range);
  const codes = new Set<string>([...opening.keys(), ...movements.map((m) => m.code)]);
  const moveByCode = new Map(movements.map((m) => [m.code, m]));
  const rows = [...codes]
    .sort()
    .map((code) => {
      const m = moveByCode.get(code);
      const openingNet = opening.get(code) ?? BigInt(0);
      const debit = m?.debitCents ?? BigInt(0);
      const credit = m?.creditCents ?? BigInt(0);
      return { code, name: m?.name ?? code, openingNetCents: openingNet, debitCents: debit, creditCents: credit, closingNetCents: openingNet + debit - credit };
    })
    .filter((r) => r.openingNetCents !== BigInt(0) || r.debitCents !== BigInt(0) || r.creditCents !== BigInt(0));
  const sum = (f: (r: (typeof rows)[number]) => bigint) => rows.reduce((s, r) => s + f(r), BigInt(0));
  return {
    rows,
    totalDebitCents: sum((r) => r.debitCents),
    totalCreditCents: sum((r) => r.creditCents),
    closingNetTotalCents: sum((r) => r.closingNetCents),
    balanced: sum((r) => r.debitCents) === sum((r) => r.creditCents),
  };
}

/** Grand livre for one account over a date range, starting from the carried-forward opening balance. */
export async function grandLivreWithOpening(ctx: Ctx, accountCode: string, range: DateRange) {
  const opening = range.from ? (await openingNets(ctx, range.from)).get(accountCode) ?? BigInt(0) : BigInt(0);
  const res = await generalLedger(ctx, accountCode, range);
  if (!res.ok) return res;
  return ok({
    openingCents: opening,
    rows: res.value.rows.map((r) => ({ ...r, balanceCents: r.balanceCents + opening })),
  });
}

/** Bilan at a date (cumulative balances). Pass the previous year-end as `asOf` for the comparison column. */
export async function bilanAt(ctx: Ctx, asOf: string): Promise<Bilan> {
  const totals = await accountTotals(ctx, { to: asOf });
  return buildBilan(totals.map((t) => ({ code: t.code, type: t.type as AccountTypeName, netCents: t.debitCents - t.creditCents })));
}

/** TCR over a period (movements). */
export async function tcrFor(ctx: Ctx, range: DateRange): Promise<Tcr> {
  const totals = await accountTotals(ctx, range);
  return buildTcr(totals.map((t) => ({ code: t.code, type: t.type as AccountTypeName, netCents: t.debitCents - t.creditCents })));
}

/** Bilan and TCR for the current period and the previous one, side by side. */
export async function statementsWithComparison(
  ctx: Ctx,
  current: { start: string; end: string },
  previous: { start: string; end: string } | null,
) {
  const bilan = await bilanAt(ctx, current.end);
  const tcr = await tcrFor(ctx, { from: current.start, to: current.end });
  const prev = previous
    ? { bilan: await bilanAt(ctx, previous.end), tcr: await tcrFor(ctx, { from: previous.start, to: previous.end }) }
    : null;
  return { bilan, tcr, previous: prev };
}
