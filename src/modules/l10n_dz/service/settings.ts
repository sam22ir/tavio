// Company tax settings: régime (réel / IFU), stamp duty methods and tiers. ⚠ needs accountant verification
import { asc, eq } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { parseDzd } from '@/core/money';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { DEFAULT_STAMP_METHODS, L10N_PAYMENT_METHODS, stampTiersFromSeed, type StampTier } from '../data';
import { l10nSettings, l10nStampTiers } from '../schema';

export const TAX_REGIMES = ['reel', 'ifu'] as const;
export type TaxRegime = (typeof TAX_REGIMES)[number];

export interface L10nSettingsView {
  taxRegime: TaxRegime;
  stampMethods: string[];
}

export interface StampTierInput {
  /** Whole DA, or null for no upper bound (last tier only). */
  upToDa: number | null;
  mode: 'fixed' | 'rate';
  /** Decimal DA text for mode fixed, e.g. "1.50". */
  fixedDa: string;
  /** Percent text for mode rate, e.g. "1.5". */
  ratePercent: string;
}

export async function getL10nSettings(ctx: Ctx): Promise<L10nSettingsView> {
  const [row] = await ctx.tx.select().from(l10nSettings).where(eq(l10nSettings.companyId, ctx.companyId)).limit(1);
  return {
    taxRegime: (row?.taxRegime as TaxRegime | undefined) ?? 'reel',
    stampMethods: row ? [...row.stampMethods] : [...DEFAULT_STAMP_METHODS],
  };
}

async function upsertSettings(ctx: Ctx, patch: Partial<L10nSettingsView>): Promise<void> {
  const current = await getL10nSettings(ctx);
  const next = { ...current, ...patch };
  await ctx.tx
    .insert(l10nSettings)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      taxRegime: next.taxRegime,
      stampMethods: next.stampMethods,
    })
    .onConflictDoUpdate({
      target: l10nSettings.companyId,
      set: { taxRegime: next.taxRegime, stampMethods: next.stampMethods, updatedAt: new Date() },
    });
}

export async function setTaxRegime(ctx: Ctx, regime: TaxRegime): Promise<Result<L10nSettingsView>> {
  const perm = requirePerm(ctx, 'l10n_dz.tax.write');
  if (!perm.ok) return perm;
  if (!(TAX_REGIMES as readonly string[]).includes(regime)) return err('VALIDATION', 'invalid regime', { messageKey: 'errors.validation' });
  const before = await getL10nSettings(ctx);
  await upsertSettings(ctx, { taxRegime: regime });
  const after = await getL10nSettings(ctx);
  await audit(ctx, { entity: 'l10n_dz.settings', recordId: ctx.companyId, action: 'update', before, after });
  return ok(after);
}

export async function setStampMethods(ctx: Ctx, methods: string[]): Promise<Result<L10nSettingsView>> {
  const perm = requirePerm(ctx, 'l10n_dz.tax.write');
  if (!perm.ok) return perm;
  const unique = [...new Set(methods)];
  if (unique.length === 0 || unique.some((m) => !(L10N_PAYMENT_METHODS as readonly string[]).includes(m))) {
    return err('VALIDATION', 'invalid payment method', { messageKey: 'errors.validation' });
  }
  const before = await getL10nSettings(ctx);
  await upsertSettings(ctx, { stampMethods: unique });
  const after = await getL10nSettings(ctx);
  await audit(ctx, { entity: 'l10n_dz.settings', recordId: ctx.companyId, action: 'update', before, after });
  return ok(after);
}

/** Stamp tiers for the company, ascending. Falls back to the seed when none are stored. */
export async function loadStampTiers(ctx: Ctx): Promise<StampTier[]> {
  const rows = await ctx.tx
    .select()
    .from(l10nStampTiers)
    .where(eq(l10nStampTiers.companyId, ctx.companyId))
    .orderBy(asc(l10nStampTiers.sortOrder));
  if (rows.length === 0) return stampTiersFromSeed();
  return rows.map((r) => ({
    upToDa: r.upToDa,
    mode: r.mode as 'fixed' | 'rate',
    fixedCents: r.fixedCents,
    ratePercent: String(r.ratePercent),
  }));
}

/** Replaces the company's stamp tiers. Rules: ascending bounds, last tier unbounded, at least one tier. */
export async function saveStampTiers(ctx: Ctx, inputs: StampTierInput[]): Promise<Result<{ count: number }>> {
  const perm = requirePerm(ctx, 'l10n_dz.tax.write');
  if (!perm.ok) return perm;
  if (inputs.length === 0) return err('VALIDATION', 'at least one tier is required', { messageKey: 'errors.validation' });

  const tiers: { upToDa: bigint | null; mode: 'fixed' | 'rate'; fixedCents: bigint; ratePercent: string }[] = [];
  for (const [i, input] of inputs.entries()) {
    const last = i === inputs.length - 1;
    if ((input.upToDa === null) !== last) {
      return err('VALIDATION', 'only the last tier can have no upper bound', { messageKey: 'errors.validation' });
    }
    if (input.upToDa !== null) {
      if (!Number.isInteger(input.upToDa) || input.upToDa <= 0) return err('VALIDATION', 'invalid bound', { messageKey: 'errors.validation' });
      const prev = tiers[i - 1]?.upToDa;
      if (prev !== undefined && prev !== null && BigInt(input.upToDa) <= prev) {
        return err('VALIDATION', 'bounds must increase', { messageKey: 'errors.validation' });
      }
    }
    let fixedCents = BigInt(0);
    if (input.mode === 'fixed') {
      const parsed = parseDzd(input.fixedDa);
      if (parsed === null || parsed < BigInt(0)) return err('VALIDATION', 'invalid fixed amount', { messageKey: 'errors.validation' });
      fixedCents = parsed;
    }
    if (!/^\d{1,3}(\.\d{1,4})?$/.test(input.ratePercent)) {
      return err('VALIDATION', 'invalid rate', { messageKey: 'errors.validation' });
    }
    tiers.push({
      upToDa: input.upToDa === null ? null : BigInt(input.upToDa),
      mode: input.mode,
      fixedCents,
      ratePercent: input.mode === 'rate' ? input.ratePercent : '0',
    });
  }

  await ctx.tx.delete(l10nStampTiers).where(eq(l10nStampTiers.companyId, ctx.companyId));
  await ctx.tx.insert(l10nStampTiers).values(
    tiers.map((t, i) => ({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      sortOrder: i + 1,
      upToDa: t.upToDa,
      mode: t.mode,
      fixedCents: t.fixedCents,
      ratePercent: t.ratePercent,
    })),
  );
  await audit(ctx, { entity: 'l10n_dz.stamp_tiers', recordId: ctx.companyId, action: 'update', after: { count: tiers.length } });
  return ok({ count: tiers.length });
}
