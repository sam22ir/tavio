// STUB owned by W4-E. Signatures are frozen.
import type { Ctx } from '@/core/ctx';
import type { Result } from '@/core/result';
import type { ListQuery, ListResult, Row } from '@/core/entities/types';
import type { creditContracts, creditContractLines, creditInstallments, creditPayments, creditReceipts } from '../schema';

export type Frequency = 'monthly' | 'weekly';
export interface ContractLineInput { productId?: string; description: string; quantity: string; unitPriceCents: bigint }
export interface DraftContractInput {
  partnerId: string;
  leadId?: string;
  lines: ContractLineInput[];
  downPaymentCents: bigint;
  markupRate: string;              // percent, e.g. "20"
  installmentsCount: number;
  frequency: Frequency;
  startDate: string;               // YYYY-MM-DD, first due date
  notes?: string;
}
export type InstallmentStatus = 'upcoming' | 'partial' | 'paid' | 'late';
export interface ContractDetail {
  contract: typeof creditContracts.$inferSelect;
  partner: { id: string; name: string; phone: string | null };
  lines: (typeof creditContractLines.$inferSelect)[];
  installments: (typeof creditInstallments.$inferSelect & { status: InstallmentStatus })[];
  payments: (typeof creditPayments.$inferSelect)[];
  receipts: (typeof creditReceipts.$inferSelect)[];
  totals: { financedCents: bigint; paidCents: bigint; remainingCents: bigint; lateCents: bigint };
}

export async function createDraftContract(_ctx: Ctx, _input: DraftContractInput): Promise<Result<{ id: string }>> { throw new Error('not implemented'); }
export async function updateDraftContract(_ctx: Ctx, _id: string, _input: DraftContractInput): Promise<Result<{ id: string }>> { throw new Error('not implemented'); }
export async function activateContract(_ctx: Ctx, _id: string): Promise<Result<{ id: string; number: string }>> { throw new Error('not implemented'); }
export async function cancelContract(_ctx: Ctx, _id: string, _reason: string): Promise<Result<{ id: string }>> { throw new Error('not implemented'); }
export async function getContract(_ctx: Ctx, _id: string): Promise<Result<ContractDetail>> { throw new Error('not implemented'); }
/** Rows carry: id, number, state, partnerName, totalCents, remainingCents, nextDueDate, startDate. */
export async function listContracts(_ctx: Ctx, _q: ListQuery): Promise<ListResult<Row>> { throw new Error('not implemented'); }
