// The only place a credit contract changes state (W13-CREDIT). Callers hold the row lock and have checked permissions.
import { eq } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { emit } from '@/core/events';
import { err, ok, type Result } from '@/core/result';
import { creditContracts, type CreditContract, type NewCreditContract } from '../schema';

export const CONTRACT_STATES = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'refused',
  'reserved',
  'active',
  'completed',
  'cancelled',
  'defaulted',
] as const;
export type ContractState = (typeof CONTRACT_STATES)[number];

const ENTITY = 'credit_sales.contract';

// Allowed moves. Anything not listed is refused.
const TRANSITIONS: Record<ContractState, readonly ContractState[]> = {
  draft: ['submitted', 'active', 'cancelled'],
  submitted: ['under_review'],
  under_review: ['approved', 'refused'],
  approved: ['reserved'],
  reserved: ['active'],
  active: ['cancelled'],
  refused: [],
  completed: [],
  cancelled: [],
  defaulted: [],
};

export function canTransition(from: string, to: string): boolean {
  return (TRANSITIONS as Record<string, readonly string[]>)[from]?.includes(to) ?? false;
}

/** States reachable from `from` in one move. Used by the workflow bar. */
export function nextStates(from: string): readonly ContractState[] {
  return (TRANSITIONS as Record<string, readonly ContractState[]>)[from] ?? [];
}

export interface TransitionInput {
  /** Audit action, for example 'submit' or 'approve'. */
  action: string;
  /** Extra columns written with the new state. */
  set?: Partial<NewCreditContract>;
  /** Extra fields recorded in the audit row's `after`. */
  auditAfter?: Record<string, unknown>;
}

/** Moves a locked contract to `toState`: checks the path, writes the audit row and emits state_changed. */
export async function transitionContract(
  ctx: Ctx,
  contract: CreditContract,
  toState: ContractState,
  input: TransitionInput,
): Promise<Result<{ id: string }>> {
  if (!canTransition(contract.state, toState)) {
    return err('STATE', `Cannot move contract from ${contract.state} to ${toState}`);
  }
  await ctx.tx
    .update(creditContracts)
    .set({ ...input.set, state: toState, updatedAt: new Date() })
    .where(eq(creditContracts.id, contract.id));
  await audit(ctx, {
    entity: ENTITY,
    recordId: contract.id,
    action: input.action,
    before: { state: contract.state },
    after: { state: toState, ...input.auditAfter },
  });
  await emit(ctx, {
    name: 'credit_sales.contract.state_changed',
    payload: { contractId: contract.id, partnerId: contract.partnerId, fromState: contract.state, toState },
  });
  return ok({ id: contract.id });
}
