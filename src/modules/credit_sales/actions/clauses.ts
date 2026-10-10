'use server';

import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
import { err, type Result } from '@/core/result';
import { parseDzd } from '@/core/money';
import { saveContractSettings } from '../service/clauses';

const settingsSchema = z.object({
  clausesFr: z.string().max(20000).nullable(),
  clausesAr: z.string().max(20000).nullable(),
  city: z.string().trim().max(120).nullable(),
  latePenaltyRate: z.string().trim().max(10).nullable(),
  /** DZD as text, e.g. "50000.00". Blank means no guarantor rule. */
  guarantorRequiredAboveDzd: z.string().trim().max(20).nullable(),
});

const saveAction = defineAction(
  { perm: 'credit_sales.contract.write', schema: settingsSchema, module: 'credit_sales' },
  (ctx, input) => saveContractSettings(ctx, {
    clausesFr: input.clausesFr,
    clausesAr: input.clausesAr,
    city: input.city,
    latePenaltyRate: input.latePenaltyRate,
    guarantorRequiredAboveCents: input.guarantorRequiredAboveDzd ? parseDzd(input.guarantorRequiredAboveDzd) : null,
  }),
);

/** Saves the company contract settings. Money is converted here, not in the service. */
export async function saveContractSettingsForm(
  input: z.input<typeof settingsSchema>,
): Promise<Result<{ id: string }>> {
  if (input.guarantorRequiredAboveDzd && parseDzd(input.guarantorRequiredAboveDzd) === null) {
    return err('VALIDATION', 'Guarantor threshold must be an amount such as 50000.00', { field: 'guarantorRequiredAboveDzd' });
  }
  return saveAction(input);
}
