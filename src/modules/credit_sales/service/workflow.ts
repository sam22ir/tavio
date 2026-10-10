// Contract workflow: submit, review, decision, reserve, back office handoff, central risk and bank (W13-CREDIT).
import { and, eq } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { requirePerm, can } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { memberships } from '@/core/db/schema';
import { creditContracts } from '../schema';
import { createContractDocuments, requiredDocumentsMissing } from './documents';
import { loadContractForUpdate } from './contracts';
import { canTransition, transitionContract } from './transitions';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENTITY = 'credit_sales.contract';
const BO_STATES = ['submitted', 'under_review'] as const;
const BANK_STATES = ['approved', 'reserved'] as const;

/** draft to submitted. Creates the document checklist from the company template. */
export async function submitContract(ctx: Ctx, id: string): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.write');
  if (!perm.ok) return perm;
  const loaded = await loadContractForUpdate(ctx, id);
  if (!loaded.ok) return loaded;
  const contract = loaded.value;
  if (!canTransition(contract.state, 'submitted')) return err('STATE', `Cannot submit a ${contract.state} contract`);
  const docs = await createContractDocuments(ctx, id);
  if (!docs.ok) return docs;
  return transitionContract(ctx, contract, 'submitted', { action: 'submit' });
}

/** submitted to under_review. Refused while a required document is not received. */
export async function startReview(ctx: Ctx, id: string): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.write');
  if (!perm.ok) return perm;
  const loaded = await loadContractForUpdate(ctx, id);
  if (!loaded.ok) return loaded;
  const contract = loaded.value;
  if (!canTransition(contract.state, 'under_review')) return err('STATE', `Cannot review a ${contract.state} contract`);
  const missing = await requiredDocumentsMissing(ctx, id);
  if (missing.length > 0) return err('STATE', `Required documents not received: ${missing.join(', ')}`);
  return transitionContract(ctx, contract, 'under_review', { action: 'review' });
}

export type Decision = 'approved' | 'refused';

/** under_review to approved or refused. A refusal needs a reason. */
export async function decideContract(
  ctx: Ctx,
  id: string,
  input: { decision: Decision; reason?: string; nextAction?: string },
): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.activate');
  if (!perm.ok) return perm;
  const reason = input.reason?.trim() || null;
  if (input.decision === 'refused' && !reason) return err('VALIDATION', 'A reason is required to refuse a contract', { field: 'reason' });
  const loaded = await loadContractForUpdate(ctx, id);
  if (!loaded.ok) return loaded;
  return transitionContract(ctx, loaded.value, input.decision, {
    action: input.decision === 'approved' ? 'approve' : 'refuse',
    set: {
      decisionReason: reason,
      nextAction: input.nextAction?.trim() || null,
      decidedBy: ctx.userId,
      decidedAt: new Date(),
    },
    auditAfter: { reason },
  });
}

/** approved to reserved. Stock reservation itself is done by the inventory handler. */
export async function markReserved(ctx: Ctx, id: string): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.activate');
  if (!perm.ok) return perm;
  const loaded = await loadContractForUpdate(ctx, id);
  if (!loaded.ok) return loaded;
  return transitionContract(ctx, loaded.value, 'reserved', { action: 'reserve' });
}

/** Hands the file to the back office owner. Does not change state. */
export async function sendToBo(ctx: Ctx, id: string, boOwnerId: string): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.write');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(boOwnerId)) return err('VALIDATION', 'boOwnerId must be a UUID', { field: 'boOwnerId' });
  const loaded = await loadContractForUpdate(ctx, id);
  if (!loaded.ok) return loaded;
  const contract = loaded.value;
  if (!(BO_STATES as readonly string[]).includes(contract.state)) {
    return err('STATE', 'Only submitted or under-review contracts can be sent to BO');
  }
  const [member] = await ctx.tx
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(
      eq(memberships.companyId, ctx.companyId),
      eq(memberships.userId, boOwnerId),
      eq(memberships.status, 'active'),
    ));
  if (!member) return err('VALIDATION', 'BO owner must be an active member of this company', { field: 'boOwnerId' });
  if (contract.sentToBoAt) return err('CONFLICT', 'Contract was already sent to BO');
  const now = new Date();
  await ctx.tx
    .update(creditContracts)
    .set({ boOwnerId, sentToBoAt: now, updatedAt: now })
    .where(eq(creditContracts.id, id));
  await audit(ctx, { entity: ENTITY, recordId: id, action: 'send_to_bo', after: { boOwnerId } });
  return ok({ id });
}

/** BO confirms receipt. Only the BO owner, or a user who can activate contracts, may do it. */
export async function acknowledgeBoReceipt(ctx: Ctx, id: string): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.read');
  if (!perm.ok) return perm;
  const loaded = await loadContractForUpdate(ctx, id);
  if (!loaded.ok) return loaded;
  const contract = loaded.value;
  const isBoOwner = contract.boOwnerId !== null && contract.boOwnerId === ctx.userId;
  if (!isBoOwner && !can(ctx.perms, 'credit_sales.contract.activate')) {
    return err('FORBIDDEN', 'Only the BO owner can acknowledge receipt');
  }
  if (!contract.sentToBoAt) return err('STATE', 'Contract was not sent to BO');
  if (contract.receivedByBoAt) return err('CONFLICT', 'Receipt already acknowledged');
  const now = new Date();
  await ctx.tx
    .update(creditContracts)
    .set({ receivedByBoAt: now, updatedAt: now })
    .where(eq(creditContracts.id, id));
  await audit(ctx, { entity: ENTITY, recordId: id, action: 'acknowledge_bo', after: { receivedByBoAt: now.toISOString() } });
  return ok({ id });
}

/** Records the central risk check result. Only while under review. */
export async function recordCentralRiskCheck(ctx: Ctx, id: string, result: 'clear' | 'flagged'): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.write');
  if (!perm.ok) return perm;
  if (result !== 'clear' && result !== 'flagged') return err('VALIDATION', 'Result must be clear or flagged', { field: 'result' });
  const loaded = await loadContractForUpdate(ctx, id);
  if (!loaded.ok) return loaded;
  const contract = loaded.value;
  if (contract.state !== 'under_review') return err('STATE', 'Central risk is checked while the contract is under review');
  const now = new Date();
  await ctx.tx
    .update(creditContracts)
    .set({ centralRiskCheckedAt: now, centralRiskResult: result, updatedAt: now })
    .where(eq(creditContracts.id, id));
  await audit(ctx, { entity: ENTITY, recordId: id, action: 'central_risk_check', before: { result: contract.centralRiskResult }, after: { result } });
  return ok({ id });
}

/** Records the bank notification. Only once the contract is approved or reserved. */
export async function notifyBank(
  ctx: Ctx,
  id: string,
  input: { bankName: string; bankReference?: string },
): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.write');
  if (!perm.ok) return perm;
  const bankName = input.bankName.trim();
  if (bankName === '') return err('VALIDATION', 'Bank name is required', { field: 'bankName' });
  const loaded = await loadContractForUpdate(ctx, id);
  if (!loaded.ok) return loaded;
  const contract = loaded.value;
  if (!(BANK_STATES as readonly string[]).includes(contract.state)) {
    return err('STATE', 'The bank is notified after approval');
  }
  if (contract.bankNotifiedAt) return err('CONFLICT', 'The bank was already notified');
  const now = new Date();
  await ctx.tx
    .update(creditContracts)
    .set({ bankName, bankReference: input.bankReference?.trim() || null, bankNotifiedAt: now, updatedAt: now })
    .where(eq(creditContracts.id, id));
  await audit(ctx, { entity: ENTITY, recordId: id, action: 'bank_notify', after: { bankName } });
  return ok({ id });
}
