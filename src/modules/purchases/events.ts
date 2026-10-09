import { on } from '@/core/events';
import type { CreditContractStateChanged } from '@/core/events/catalog';
import type { Ctx } from '@/core/ctx';
import { createOrdersFromApprovedContract } from './service/contract-orders';

// Side-effect module: imported from src/modules/purchases/index.ts so the handler is registered.
// Idempotent: createOrdersFromApprovedContract returns early when the contract already has orders.
on('credit_sales.contract.state_changed', async (ctx: Ctx, event) => {
  const p = event.payload as CreditContractStateChanged;
  if (p.toState !== 'approved') return;
  await createOrdersFromApprovedContract(ctx, p.contractId);
});
