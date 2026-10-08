import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { err, ok, type Result } from '@/core/result';
import { DZ_TAX_DEFAULTS } from '../data';
import { taxes, type Tax } from '../schema';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RATE_RE = /^\d{1,3}(\.\d{1,4})?$/;

// Empty optional strings from HTML forms become null.
const emptyToNull = (v: unknown) => (v === '' || v === undefined ? null : v);

export const taxInput = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(100),
  kind: z.enum(['vat', 'stamp', 'other']),
  rate: z.string().trim().regex(RATE_RE, 'Invalid rate'),
  scope: z.enum(['sale', 'purchase', 'both']),
  validFrom: z.string().regex(DATE_RE, 'Invalid date'),
  validTo: z.preprocess(emptyToNull, z.string().regex(DATE_RE, 'Invalid date').nullable()).optional(),
  legalRef: z.preprocess(emptyToNull, z.string().trim().max(500).nullable()).optional(),
  isDefaultSale: z.boolean().default(false),
  isDefaultPurchase: z.boolean().default(false),
  active: z.boolean().default(true),
});
export type TaxInput = z.output<typeof taxInput>;

function checkDates(validFrom: string, validTo: string | null | undefined): Result<void> {
  if (validTo && validTo < validFrom) return err('VALIDATION', 'validTo must be on or after validFrom');
  return ok(undefined);
}

/** Active and inactive taxes for the company, sorted by code then validFrom. */
export async function listTaxes(ctx: Ctx): Promise<Tax[]> {
  return ctx.tx
    .select()
    .from(taxes)
    .where(eq(taxes.companyId, ctx.companyId))
    .orderBy(asc(taxes.code), asc(taxes.validFrom));
}

export async function createTax(ctx: Ctx, input: TaxInput): Promise<Result<Tax>> {
  const dates = checkDates(input.validFrom, input.validTo);
  if (!dates.ok) return dates;

  const dup = await ctx.tx
    .select({ id: taxes.id })
    .from(taxes)
    .where(
      and(eq(taxes.companyId, ctx.companyId), eq(taxes.code, input.code), eq(taxes.validFrom, input.validFrom)),
    )
    .limit(1);
  if (dup.length > 0) return err('CONFLICT', 'A tax with this code and start date already exists');

  const [row] = await ctx.tx
    .insert(taxes)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      code: input.code,
      name: input.name,
      kind: input.kind,
      rate: input.rate,
      scope: input.scope,
      validFrom: input.validFrom,
      validTo: input.validTo ?? null,
      legalRef: input.legalRef ?? null,
      isDefaultSale: input.isDefaultSale,
      isDefaultPurchase: input.isDefaultPurchase,
      active: input.active,
    })
    .returning();
  if (!row) return err('INTERNAL', 'Insert returned no row');

  await audit(ctx, { entity: 'l10n_dz.tax', recordId: row.id, action: 'create', after: row });
  return ok(row);
}

export async function updateTax(ctx: Ctx, id: string, patch: Partial<TaxInput>): Promise<Result<Tax>> {
  const [before] = await ctx.tx
    .select()
    .from(taxes)
    .where(and(eq(taxes.id, id), eq(taxes.companyId, ctx.companyId)))
    .limit(1);
  if (!before) return err('NOT_FOUND', 'Tax not found');

  const validFrom = patch.validFrom ?? before.validFrom;
  const validTo = patch.validTo !== undefined ? patch.validTo : before.validTo;
  const dates = checkDates(validFrom, validTo);
  if (!dates.ok) return dates;

  const [after] = await ctx.tx
    .update(taxes)
    .set({
      ...(patch.code !== undefined && { code: patch.code }),
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.kind !== undefined && { kind: patch.kind }),
      ...(patch.rate !== undefined && { rate: patch.rate }),
      ...(patch.scope !== undefined && { scope: patch.scope }),
      ...(patch.validFrom !== undefined && { validFrom: patch.validFrom }),
      ...(patch.validTo !== undefined && { validTo: patch.validTo }),
      ...(patch.legalRef !== undefined && { legalRef: patch.legalRef }),
      ...(patch.isDefaultSale !== undefined && { isDefaultSale: patch.isDefaultSale }),
      ...(patch.isDefaultPurchase !== undefined && { isDefaultPurchase: patch.isDefaultPurchase }),
      ...(patch.active !== undefined && { active: patch.active }),
      updatedAt: sql`now()`,
    })
    .where(and(eq(taxes.id, id), eq(taxes.companyId, ctx.companyId)))
    .returning();
  if (!after) return err('NOT_FOUND', 'Tax not found');

  await audit(ctx, { entity: 'l10n_dz.tax', recordId: id, action: 'update', before, after });
  return ok(after);
}

/** Soft delete: sets active = false. */
export async function archiveTax(ctx: Ctx, id: string): Promise<Result<Tax>> {
  const [before] = await ctx.tx
    .select()
    .from(taxes)
    .where(and(eq(taxes.id, id), eq(taxes.companyId, ctx.companyId)))
    .limit(1);
  if (!before) return err('NOT_FOUND', 'Tax not found');
  if (!before.active) return ok(before);

  const [after] = await ctx.tx
    .update(taxes)
    .set({ active: false, updatedAt: sql`now()` })
    .where(and(eq(taxes.id, id), eq(taxes.companyId, ctx.companyId)))
    .returning();
  if (!after) return err('NOT_FOUND', 'Tax not found');

  await audit(ctx, { entity: 'l10n_dz.tax', recordId: id, action: 'archive', before, after });
  return ok(after);
}

/** Inserts DZ_TAX_DEFAULTS that are missing for this company. Idempotent. */
export async function loadAlgerianDefaults(ctx: Ctx): Promise<Result<{ inserted: number }>> {
  const rows = DZ_TAX_DEFAULTS.map((d) => ({
    companyId: ctx.companyId,
    createdBy: ctx.userId,
    code: d.code,
    name: d.name,
    kind: d.kind,
    rate: d.rate,
    scope: d.scope,
    validFrom: d.validFrom,
    validTo: d.validTo,
    legalRef: d.legalRef,
    isDefaultSale: d.isDefaultSale,
    isDefaultPurchase: d.isDefaultPurchase,
  }));

  const inserted = await ctx.tx
    .insert(taxes)
    .values(rows)
    .onConflictDoNothing({ target: [taxes.companyId, taxes.code, taxes.validFrom] })
    .returning({ id: taxes.id, code: taxes.code });

  for (const row of inserted) {
    await audit(ctx, { entity: 'l10n_dz.tax', recordId: row.id, action: 'load_default', after: row });
  }
  return ok({ inserted: inserted.length });
}

export interface TaxOption {
  value: string;
  label: string;
}

/** Active taxes for selects: label is "CODE · rate%". */
export async function taxOptions(ctx: Ctx): Promise<TaxOption[]> {
  const rows = await ctx.tx
    .select({ id: taxes.id, code: taxes.code, rate: taxes.rate })
    .from(taxes)
    .where(and(eq(taxes.companyId, ctx.companyId), eq(taxes.active, true)))
    .orderBy(asc(taxes.code), asc(taxes.validFrom))
    .limit(200);
  return rows.map((r) => ({ value: r.id, label: `${r.code} · ${Number(r.rate)}%` }));
}
