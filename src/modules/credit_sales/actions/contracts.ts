'use server';

import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
import { err, type Result } from '@/core/result';
import {
  activateContract,
  cancelContract,
  createDraftContract,
  updateDraftContract,
  type DraftContractInput,
} from '../service/contracts';

const money = z.string().regex(/^\d+$/, 'INVALID_AMOUNT').transform((v) => BigInt(v));

const lineSchema = z.object({
  productId: z.string().uuid().optional(),
  description: z.string().trim().min(1),
  quantity: z.string().regex(/^\d+(\.\d{1,3})?$/),
  unitPriceCents: money,
});

const draftContractSchema = z.object({
  partnerId: z.string().uuid(),
  leadId: z.string().uuid().optional(),
  lines: z.array(lineSchema).min(1),
  downPaymentCents: money,
  markupRate: z.string().regex(/^\d+(\.\d{1,4})?$/),
  installmentsCount: z.coerce.number().int().min(1).max(120),
  frequency: z.enum(['monthly', 'weekly']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(2000).optional(),
});

const idSchema = z.object({ id: z.string().uuid() });
const cancelSchema = z.object({ id: z.string().uuid(), reason: z.string().trim().min(1).max(500) });



const createDraftAction = defineAction(
  { perm: 'credit_sales.contract.write', schema: draftContractSchema, module: 'credit_sales' },
  (ctx, input) => createDraftContract(ctx, input as DraftContractInput),
);

const updateDraftAction = defineAction(
  { perm: 'credit_sales.contract.write', schema: draftContractSchema.and(z.object({ id: z.string().uuid() })), module: 'credit_sales' },
  (ctx, input) => {
    const { id, ...rest } = input;
    return updateDraftContract(ctx, id, rest as DraftContractInput);
  },
);

const activateContractAction = defineAction(
  { perm: 'credit_sales.contract.activate', schema: idSchema, module: 'credit_sales' },
  (ctx, input) => activateContract(ctx, input.id),
);

const cancelContractAction = defineAction(
  { perm: 'credit_sales.contract.cancel', schema: cancelSchema, module: 'credit_sales' },
  (ctx, input) => cancelContract(ctx, input.id, input.reason),
);

/** Server action wrappers for client components. Each returns a Result and never throws. */
export async function createDraft(input: unknown): Promise<Result<{ id: string }>> {
  return createDraftAction(input as z.input<typeof draftContractSchema>);
}
export async function updateDraft(input: unknown): Promise<Result<{ id: string }>> {
  return updateDraftAction(input as never);
}
export async function activateContractById(id: string): Promise<Result<{ id: string; number: string }>> {
  return activateContractAction({ id });
}
export async function cancelContractById(id: string, reason: string): Promise<Result<{ id: string }>> {
  if (!id || !reason) return err('VALIDATION', 'Missing id or reason');
  return cancelContractAction({ id, reason });
}
