'use server';
import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
import { parseDzd } from '@/core/money';
import { err } from '@/core/result';
import { recordPayment } from '../service/payments';

const recordPaymentSchema = z.object({
  contractId: z.string().min(1),
  amount: z.string().min(1),
  method: z.enum(['cash', 'ccp', 'transfer', 'cib', 'edahabia', 'cheque']),
  reference: z.string().trim().max(120).optional(),
  isDownPayment: z.boolean().optional(),
  chequeNumber: z.string().trim().max(60).optional(),
  chequeDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const recordPaymentAction = defineAction(
  { perm: 'credit_sales.payment.write', schema: recordPaymentSchema, module: 'credit_sales' },
  async (ctx, input) => {
    const amountCents = parseDzd(input.amount);
    if (amountCents === null || amountCents <= 0n) {
      return err('VALIDATION', 'Invalid amount', {
        issues: [{ path: ['amount'], message: 'invalid', code: 'custom' }],
      });
    }
    return recordPayment(ctx, {
      contractId: input.contractId,
      amountCents,
      method: input.method,
      reference: input.reference || undefined,
      isDownPayment: input.isDownPayment ?? false,
      chequeNumber: input.chequeNumber || undefined,
      chequeDueDate: input.chequeDueDate || undefined,
    });
  },
);
