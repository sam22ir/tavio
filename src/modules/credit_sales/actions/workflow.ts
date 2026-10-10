'use server';

import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
import type { Result } from '@/core/result';
import {
  acknowledgeBoReceipt,
  decideContract,
  markReserved,
  notifyBank,
  recordCentralRiskCheck,
  sendToBo,
  startReview,
  submitContract,
} from '../service/workflow';
import { saveDocumentRequirement, setContractDocumentStatus } from '../service/documents';

const idSchema = z.object({ id: z.string().uuid() });
const decideSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(['approved', 'refused']),
  reason: z.string().trim().max(500).optional(),
  nextAction: z.string().trim().max(500).optional(),
});
const boSchema = z.object({ id: z.string().uuid(), boOwnerId: z.string().uuid() });
const riskSchema = z.object({ id: z.string().uuid(), result: z.enum(['clear', 'flagged']) });
const bankSchema = z.object({
  id: z.string().uuid(),
  bankName: z.string().trim().min(1).max(120),
  bankReference: z.string().trim().max(120).optional(),
});
const documentSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['missing', 'received', 'rejected']),
  fileId: z.string().uuid().nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});
const requirementSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  required: z.boolean(),
  active: z.boolean(),
});

const submitAction = defineAction(
  { perm: 'credit_sales.contract.write', schema: idSchema, module: 'credit_sales' },
  (ctx, input) => submitContract(ctx, input.id),
);
const reviewAction = defineAction(
  { perm: 'credit_sales.contract.write', schema: idSchema, module: 'credit_sales' },
  (ctx, input) => startReview(ctx, input.id),
);
const decideAction = defineAction(
  { perm: 'credit_sales.contract.activate', schema: decideSchema, module: 'credit_sales' },
  (ctx, input) => decideContract(ctx, input.id, input),
);
const reserveAction = defineAction(
  { perm: 'credit_sales.contract.activate', schema: idSchema, module: 'credit_sales' },
  (ctx, input) => markReserved(ctx, input.id),
);
const boAction = defineAction(
  { perm: 'credit_sales.contract.write', schema: boSchema, module: 'credit_sales' },
  (ctx, input) => sendToBo(ctx, input.id, input.boOwnerId),
);
const boAckAction = defineAction(
  { perm: 'credit_sales.contract.read', schema: idSchema, module: 'credit_sales' },
  (ctx, input) => acknowledgeBoReceipt(ctx, input.id),
);
const riskAction = defineAction(
  { perm: 'credit_sales.contract.write', schema: riskSchema, module: 'credit_sales' },
  (ctx, input) => recordCentralRiskCheck(ctx, input.id, input.result),
);
const bankAction = defineAction(
  { perm: 'credit_sales.contract.write', schema: bankSchema, module: 'credit_sales' },
  (ctx, input) => notifyBank(ctx, input.id, input),
);
const documentAction = defineAction(
  { perm: 'credit_sales.contract.write', schema: documentSchema, module: 'credit_sales' },
  (ctx, input) => setContractDocumentStatus(ctx, input.id, {
    status: input.status,
    fileId: input.fileId,
    note: input.note ?? null,
  }),
);
const requirementAction = defineAction(
  { perm: 'credit_sales.contract.write', schema: requirementSchema, module: 'credit_sales' },
  (ctx, input) => saveDocumentRequirement(ctx, input),
);

/** Server action wrappers for the workflow UI. Each returns a Result and never throws. */
export async function submitContractById(id: string): Promise<Result<{ id: string }>> {
  return submitAction({ id });
}
export async function startReviewById(id: string): Promise<Result<{ id: string }>> {
  return reviewAction({ id });
}
export async function decideContractById(
  input: { id: string; decision: 'approved' | 'refused'; reason?: string; nextAction?: string },
): Promise<Result<{ id: string }>> {
  return decideAction(input);
}
export async function markReservedById(id: string): Promise<Result<{ id: string }>> {
  return reserveAction({ id });
}
export async function sendToBoAction(id: string, boOwnerId: string): Promise<Result<{ id: string }>> {
  return boAction({ id, boOwnerId });
}
export async function acknowledgeBoAction(id: string): Promise<Result<{ id: string }>> {
  return boAckAction({ id });
}
export async function recordCentralRiskAction(id: string, result: 'clear' | 'flagged'): Promise<Result<{ id: string }>> {
  return riskAction({ id, result });
}
export async function notifyBankAction(
  input: { id: string; bankName: string; bankReference?: string },
): Promise<Result<{ id: string }>> {
  return bankAction(input);
}
export async function setDocumentStatusAction(
  input: { id: string; status: 'missing' | 'received' | 'rejected'; fileId?: string | null; note?: string | null },
): Promise<Result<{ id: string }>> {
  return documentAction(input);
}
export async function saveDocumentRequirementAction(
  input: { id?: string; name: string; required: boolean; active: boolean },
): Promise<Result<{ id: string }>> {
  return requirementAction(input);
}
