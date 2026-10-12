'use server';
import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
import {
  cancelBatch,
  closeBatch,
  createBatch,
  deactivateMandate,
  dismissItem,
  importResults,
  markRemainingPaid,
  saveMandate,
  settleItem,
} from '../service/debits';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const WRITE = { perm: 'credit_sales.payment.write', module: 'credit_sales' } as const;

export const saveMandateAction = defineAction(
  { ...WRITE, schema: z.object({ contractId: z.string().min(1), ccpAccount: z.string().trim().min(1).max(40), signedOn: day }) },
  (ctx, input) => saveMandate(ctx, input),
);

export const deactivateMandateAction = defineAction(
  { ...WRITE, schema: z.object({ contractId: z.string().min(1) }) },
  (ctx, input) => deactivateMandate(ctx, input.contractId),
);

export const createBatchAction = defineAction(
  { ...WRITE, schema: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }) },
  (ctx, input) => createBatch(ctx, input),
);

export const settleItemAction = defineAction(
  {
    ...WRITE,
    schema: z.object({
      itemId: z.string().min(1),
      outcome: z.enum(['paid', 'rejected']),
      settledOn: day.optional(),
      reason: z.string().trim().max(200).optional(),
    }),
  },
  (ctx, input) => settleItem(ctx, input),
);

export const markRemainingPaidAction = defineAction(
  { ...WRITE, schema: z.object({ batchId: z.string().min(1), settledOn: day.optional() }) },
  (ctx, input) => markRemainingPaid(ctx, input),
);

// The file is read in the browser and sent as text; the size is capped here as well as by the row limit in the parser.
export const importResultsAction = defineAction(
  { ...WRITE, schema: z.object({ batchId: z.string().min(1), text: z.string().max(200_000) }) },
  (ctx, input) => importResults(ctx, input),
);

export const dismissItemAction = defineAction(
  { ...WRITE, schema: z.object({ itemId: z.string().min(1) }) },
  (ctx, input) => dismissItem(ctx, input.itemId),
);

export const closeBatchAction = defineAction(
  { ...WRITE, schema: z.object({ batchId: z.string().min(1) }) },
  (ctx, input) => closeBatch(ctx, input.batchId),
);

export const cancelBatchAction = defineAction(
  { ...WRITE, schema: z.object({ batchId: z.string().min(1) }) },
  (ctx, input) => cancelBatch(ctx, input.batchId),
);
