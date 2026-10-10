// Contract clause templates and per-company contract settings (W15-B).
import { eq } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { creditContractSettings } from '../schema';
import { DEFAULT_CLAUSES_AR, DEFAULT_CLAUSES_FR } from './clause-defaults';

/** Variables a company template may use. Each {name} token is replaced when rendering. */
export const CLAUSE_VARIABLES = [
  'client_nom',
  'client_nin',
  'client_adresse',
  'societe_nom',
  'societe_nif',
  'montant_comptant',
  'apport',
  'montant_finance',
  'majoration',
  'nombre_echeances',
  'montant_echeance',
  'date_premiere_echeance',
  'frequence',
  'penalite_retard',
  'garant_nom',
  'date_contrat',
  'ville',
] as const;
export type ClauseVariable = (typeof CLAUSE_VARIABLES)[number];

/** Visible fill-in line used for any variable without a value, so braces never reach the print. */
export const BLANK_FIELD = '____________';
const MAX_TEMPLATE_CHARS = 20000;
const PENALTY_RE = /^\d{1,3}(\.\d{1,4})?$/;
const ENTITY = 'credit_sales.contract_settings';

/** Pure: replaces every {token} with its value. Missing, empty or unknown tokens become a blank line. */
export function renderClauseTemplate(
  template: string,
  values: Partial<Record<string, string | null | undefined>>,
): string {
  return template.replace(/\{([a-z_]+)\}/g, (_match, name: string) => {
    const value = values[name];
    return value !== undefined && value !== null && value.trim() !== '' ? value.trim() : BLANK_FIELD;
  });
}

/** Pure: the template for a locale. Companies without a saved text get the default. English uses French. */
export function templateFor(
  locale: 'fr' | 'ar' | 'en',
  settings: { clausesFr: string | null; clausesAr: string | null },
): string {
  if (locale === 'ar') return settings.clausesAr?.trim() ? settings.clausesAr : DEFAULT_CLAUSES_AR;
  return settings.clausesFr?.trim() ? settings.clausesFr : DEFAULT_CLAUSES_FR;
}

/** Pure: the clause text split into printable paragraphs (empty lines are kept as spacing). */
export function clauseParagraphs(rendered: string): string[] {
  return rendered.split(/\r?\n/);
}

/** Pure: a guarantor is required when the financed amount is above the company threshold. */
export function guarantorRequired(financedCents: bigint, thresholdCents: bigint | null): boolean {
  return thresholdCents !== null && financedCents > thresholdCents;
}

export interface ContractSettings {
  clausesFr: string | null;
  clausesAr: string | null;
  city: string | null;
  latePenaltyRate: string | null;
  guarantorRequiredAboveCents: bigint | null;
}

const EMPTY_SETTINGS: ContractSettings = {
  clausesFr: null,
  clausesAr: null,
  city: null,
  latePenaltyRate: null,
  guarantorRequiredAboveCents: null,
};

/** Reads the company settings without a permission check. For the print and activation paths, which run after their own checks. */
export async function loadContractSettings(ctx: Ctx): Promise<ContractSettings> {
  const [row] = await ctx.tx
    .select({
      clausesFr: creditContractSettings.clausesFr,
      clausesAr: creditContractSettings.clausesAr,
      city: creditContractSettings.city,
      latePenaltyRate: creditContractSettings.latePenaltyRate,
      guarantorRequiredAboveCents: creditContractSettings.guarantorRequiredAboveCents,
    })
    .from(creditContractSettings)
    .where(eq(creditContractSettings.companyId, ctx.companyId))
    .limit(1);
  return row ?? EMPTY_SETTINGS;
}

export async function getContractSettings(ctx: Ctx): Promise<Result<ContractSettings>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.read');
  if (!perm.ok) return perm;
  return ok(await loadContractSettings(ctx));
}

export type SaveContractSettingsInput = ContractSettings;

/** Upserts the company settings. Blank clause text clears the override and the default applies again. */
export async function saveContractSettings(ctx: Ctx, input: SaveContractSettingsInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.write');
  if (!perm.ok) return perm;
  const clausesFr = input.clausesFr?.trim() || null;
  const clausesAr = input.clausesAr?.trim() || null;
  for (const [field, text] of [['clausesFr', clausesFr], ['clausesAr', clausesAr]] as const) {
    if (text !== null && text.length > MAX_TEMPLATE_CHARS) {
      return err('VALIDATION', `Clause text is longer than ${MAX_TEMPLATE_CHARS} characters`, { field });
    }
  }
  const penalty = input.latePenaltyRate?.trim() || null;
  if (penalty !== null && !PENALTY_RE.test(penalty)) {
    return err('VALIDATION', 'Late penalty must be a percentage such as 2.5', { field: 'latePenaltyRate' });
  }
  const threshold = input.guarantorRequiredAboveCents;
  if (threshold !== null && threshold < BigInt(0)) {
    return err('VALIDATION', 'Guarantor threshold cannot be negative', { field: 'guarantorRequiredAboveCents' });
  }
  const values = {
    clausesFr,
    clausesAr,
    city: input.city?.trim() || null,
    latePenaltyRate: penalty,
    guarantorRequiredAboveCents: threshold,
    updatedAt: new Date(),
  };

  const [existing] = await ctx.tx
    .select({ id: creditContractSettings.id })
    .from(creditContractSettings)
    .where(eq(creditContractSettings.companyId, ctx.companyId))
    .limit(1);
  if (existing) {
    await ctx.tx.update(creditContractSettings).set(values).where(eq(creditContractSettings.id, existing.id));
    await audit(ctx, { entity: ENTITY, recordId: existing.id, action: 'update', after: { hasCustomClauses: clausesFr !== null || clausesAr !== null } });
    return ok({ id: existing.id });
  }
  const [row] = await ctx.tx
    .insert(creditContractSettings)
    .values({ ...values, companyId: ctx.companyId, createdBy: ctx.userId })
    .returning({ id: creditContractSettings.id });
  if (!row) return err('INTERNAL', 'Insert returned no row');
  await audit(ctx, { entity: ENTITY, recordId: row.id, action: 'create', after: { hasCustomClauses: clausesFr !== null || clausesAr !== null } });
  return ok({ id: row.id });
}
