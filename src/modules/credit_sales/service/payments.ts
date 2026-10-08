// STUB owned by W4-F. Signatures are frozen.
import type { Ctx } from '@/core/ctx';
import type { Result } from '@/core/result';
import type { ListQuery, ListResult, Row } from '@/core/entities/types';

export type PaymentMethod = 'cash' | 'ccp' | 'transfer' | 'cib' | 'edahabia' | 'cheque';
export interface RecordPaymentInput {
  contractId: string;
  amountCents: bigint;
  method: PaymentMethod;
  receivedAt?: string;           // ISO; default now
  reference?: string;
  isDownPayment?: boolean;
}
export interface OverdueRow {
  contractId: string; contractNumber: string;
  partnerId: string; partnerName: string; partnerPhone: string | null;
  installmentId: string; seq: number; dueDate: string;
  dueCents: bigint; daysLate: number;
}
/** Allocates oldest-due-first, writes allocations + receipt (gap-free number), emits credit_sales.payment.recorded. */
export async function recordPayment(_ctx: Ctx, _input: RecordPaymentInput): Promise<Result<{ paymentId: string; receiptId: string; receiptNumber: string }>> { throw new Error('not implemented'); }
export async function listOverdue(_ctx: Ctx, _opts?: { limit?: number; partnerId?: string }): Promise<OverdueRow[]> { throw new Error('not implemented'); }
export async function listDueSoon(_ctx: Ctx, _days: number): Promise<OverdueRow[]> { throw new Error('not implemented'); }
/** Rows carry: id, receivedAt, partnerName, contractNumber, amountCents, method, receiptNumber, receiptId. */
export async function listPayments(_ctx: Ctx, _q: ListQuery): Promise<ListResult<Row>> { throw new Error('not implemented'); }
