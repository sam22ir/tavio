'use server';

import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
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
