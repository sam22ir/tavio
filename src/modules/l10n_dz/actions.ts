'use server';

import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
import { ok } from '@/core/result';
import { prepareG50, validateG50 } from './service/g50';
import { saveStampTiers, setStampMethods, setTaxRegime } from './service/settings';
import { archiveTax, createTax, loadAlgerianDefaults, taxInput, updateTax } from './service/taxes';

const idSchema = z.object({ id: z.uuid() });
const updateSchema = z.object({ id: z.uuid(), patch: taxInput.partial() });

export const createTaxAction = defineAction(
  { perm: 'l10n_dz.tax.write', schema: taxInput, module: 'l10n_dz' },
  (ctx, input) => createTax(ctx, input),
);

export const updateTaxAction = defineAction(
  { perm: 'l10n_dz.tax.write', schema: updateSchema, module: 'l10n_dz' },
  (ctx, input) => updateTax(ctx, input.id, input.patch),
);

export const archiveTaxAction = defineAction(
  { perm: 'l10n_dz.tax.write', schema: idSchema, module: 'l10n_dz' },
  (ctx, input) => archiveTax(ctx, input.id),
);

export const loadAlgerianDefaultsAction = defineAction(
  { perm: 'l10n_dz.tax.write', schema: z.object({}), module: 'l10n_dz' },
  (ctx) => loadAlgerianDefaults(ctx),
);

const regimeSchema = z.object({ regime: z.enum(['reel', 'ifu']) });
const stampSettingsSchema = z.object({
  methods: z.array(z.string().min(1).max(20)).min(1),
  tiers: z
    .array(
      z.object({
        upToDa: z.number().int().positive().nullable(),
        mode: z.enum(['fixed', 'rate']),
        fixedDa: z.string().trim().max(20),
        ratePercent: z.string().trim().max(10),
      }),
    )
    .min(1)
    .max(10),
});
const g50PeriodSchema = z.object({ year: z.number().int().min(2000).max(2100), month: z.number().int().min(1).max(12) });

export const setTaxRegimeAction = defineAction(
  { perm: 'l10n_dz.tax.write', schema: regimeSchema, module: 'l10n_dz' },
  (ctx, input) => setTaxRegime(ctx, input.regime),
);

export const saveStampSettingsAction = defineAction(
  { perm: 'l10n_dz.tax.write', schema: stampSettingsSchema, module: 'l10n_dz' },
  async (ctx, input) => {
    const methods = await setStampMethods(ctx, input.methods);
    if (!methods.ok) return methods;
    const tiers = await saveStampTiers(ctx, input.tiers);
    if (!tiers.ok) return tiers;
    return ok({ count: tiers.value.count });
  },
);

export const prepareG50Action = defineAction(
  { perm: 'l10n_dz.g50.write', schema: g50PeriodSchema, module: 'l10n_dz' },
  (ctx, input) => prepareG50(ctx, input.year, input.month),
);

export const validateG50Action = defineAction(
  { perm: 'l10n_dz.g50.post', schema: g50PeriodSchema, module: 'l10n_dz' },
  (ctx, input) => validateG50(ctx, input.year, input.month),
);
