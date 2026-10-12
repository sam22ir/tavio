// W4-F: payments service. Signatures are frozen; bodies implemented here.
import { and, asc, count, desc, eq, gte, ilike, lt, lte, or, type SQL, sql } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { err, ok, type Result } from '@/core/result';
import type { ListQuery, ListResult, Row } from '@/core/entities/types';
import { audit } from '@/core/audit';
import { emit } from '@/core/events';
import { nextNumber } from '@/core/sequences';
import { partners } from '@/modules/contacts/schema';
import {
  creditContracts,
  creditInstallments,
  creditPaymentAllocations,
  creditPayments,
  creditReceipts,
} from '../schema';

export type PaymentMethod = 'cash' | 'ccp' | 'transfer' | 'cib' | 'edahabia' | 'cheque';
export interface RecordPaymentInput {
  contractId: string;
  amountCents: bigint;
  method: PaymentMethod;
  receivedAt?: string;           // ISO; default now
  reference?: string;
  isDownPayment?: boolean;
  /** Required when method is 'cheque'. YYYY-MM-DD. */
  chequeDueDate?: string;
  /** Cheque number. Stored in external_ref (no dedicated column); takes precedence over reference. */
  chequeNumber?: string;
  /**
   * Apply the whole payment to this installment only (it must belong to the contract and be open for at least the amount).
   * Used by CCP direct debits, where each debit settles one specific installment regardless of what is older.
   * Without it the payment fills installments oldest first.
   */
  installmentId?: string;
}
export interface OverdueRow {
  contractId: string; contractNumber: string;
  partnerId: string; partnerName: string; partnerPhone: string | null;
  installmentId: string; seq: number; dueDate: string;
  dueCents: bigint; daysLate: number;
}

const DAY_MS = 86_400_000;
const ALGIERS_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Algiers',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's business date in Africa/Algiers, as YYYY-MM-DD. */
function todayAlgiers(now: Date = new Date()): string {
  return ALGIERS_DATE.format(now);
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

/** Allocates oldest-due-first, writes allocations + receipt (gap-free number), emits credit_sales.payment.recorded. */
export async function recordPayment(
  ctx: Ctx,
  input: RecordPaymentInput,
): Promise<Result<{ paymentId: string; receiptId: string; receiptNumber: string }>> {
  if (input.amountCents <= BigInt(0)) return err('VALIDATION', 'INVALID_AMOUNT');
  if (input.method === 'cheque' && !input.chequeDueDate) {
    return err('VALIDATION', 'CHEQUE_DUE_DATE_REQUIRED');
  }

  const [contract] = await ctx.tx
    .select()
    .from(creditContracts)
    .where(eq(creditContracts.id, input.contractId))
    .for('update');
  if (!contract) return err('NOT_FOUND', 'CONTRACT_NOT_FOUND');
  if (contract.state !== 'active') return err('STATE', 'CONTRACT_NOT_ACTIVE');

  const installments = await ctx.tx
    .select()
    .from(creditInstallments)
    .where(eq(creditInstallments.contractId, contract.id))
    .orderBy(asc(creditInstallments.dueDate), asc(creditInstallments.seq))
    .for('update');

  const isDown = input.isDownPayment === true;
  if (isDown && input.installmentId !== undefined) return err('VALIDATION', 'DOWN_PAYMENT_HAS_NO_INSTALLMENT');
  if (isDown) {
    const [existing] = await ctx.tx
      .select({ id: creditPaymentAllocations.id })
      .from(creditPaymentAllocations)
      .where(eq(creditPaymentAllocations.contractId, contract.id))
      .limit(1);
    if (existing || contract.downPaymentPaidCents > BigInt(0)) {
      return err('STATE', 'DOWN_PAYMENT_ALREADY_RECORDED');
    }
    if (input.amountCents > contract.downPaymentCents) return err('VALIDATION', 'OVERPAYMENT');
  } else if (input.installmentId !== undefined) {
    const target = installments.find((i) => i.id === input.installmentId);
    if (!target) return err('NOT_FOUND', 'INSTALLMENT_NOT_FOUND');
    if (input.amountCents > target.amountCents - target.paidCents) return err('VALIDATION', 'OVERPAYMENT');
  } else {
    const remaining = installments.reduce(
      (sum, i) => sum + (i.amountCents - i.paidCents),
      BigInt(0),
    );
    if (input.amountCents > remaining) return err('VALIDATION', 'OVERPAYMENT');
  }

  const receivedAt = input.receivedAt ?? new Date().toISOString();
  const reference = await nextNumber(ctx, 'payment', { prefix: 'PAY-' });

  const [payment] = await ctx.tx
    .insert(creditPayments)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      reference,
      partnerId: contract.partnerId,
      method: input.method,
      amountCents: input.amountCents,
      receivedAt: new Date(receivedAt),
      receivedBy: ctx.userId,
      externalRef: input.chequeNumber ?? input.reference ?? null,
      chequeDueDate: input.method === 'cheque' ? (input.chequeDueDate ?? null) : null,
    })
    .returning({ id: creditPayments.id });
  if (!payment) throw new Error('payment insert returned no row');

  // Allocations. The down payment goes to the contract; the rest fills installments oldest first.
  let left = input.amountCents;
  if (isDown) {
    await ctx.tx.insert(creditPaymentAllocations).values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      paymentId: payment.id,
      contractId: contract.id,
      amountCents: input.amountCents,
    });
    await ctx.tx
      .update(creditContracts)
      .set({ downPaymentPaidCents: contract.downPaymentPaidCents + input.amountCents })
      .where(eq(creditContracts.id, contract.id));
    left = BigInt(0);
  }
  const allocationTargets = input.installmentId === undefined ? installments : installments.filter((i) => i.id === input.installmentId);
  for (const inst of allocationTargets) {
    if (left <= BigInt(0)) break;
    const open = inst.amountCents - inst.paidCents;
    if (open <= BigInt(0)) continue;
    const take = left < open ? left : open;
    await ctx.tx.insert(creditPaymentAllocations).values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      paymentId: payment.id,
      installmentId: inst.id,
      amountCents: take,
    });
    await ctx.tx
      .update(creditInstallments)
      .set({ paidCents: inst.paidCents + take, lastPaidAt: new Date(receivedAt) })
      .where(eq(creditInstallments.id, inst.id));
    left -= take;
  }

  const receiptNumber = await nextNumber(ctx, 'credit_sales.receipt', { prefix: 'RC-{YYYY}-' });
  const [receipt] = await ctx.tx
    .insert(creditReceipts)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      number: receiptNumber,
      paymentId: payment.id,
      partnerId: contract.partnerId,
      issuedAt: new Date(),
      totalCents: input.amountCents,
    })
    .returning({ id: creditReceipts.id });
  if (!receipt) throw new Error('receipt insert returned no row');

  await audit(ctx, {
    entity: 'credit_sales.payment',
    recordId: payment.id,
    action: 'create',
    after: {
      contractId: contract.id,
      amountCents: input.amountCents,
      method: input.method,
      isDownPayment: isDown,
      receiptNumber,
    },
  });

  // Completion: every installment paid and the down payment fully paid.
  const after = await ctx.tx
    .select({ amountCents: creditInstallments.amountCents, paidCents: creditInstallments.paidCents })
    .from(creditInstallments)
    .where(eq(creditInstallments.contractId, contract.id));
  const allInstallmentsPaid = after.every((i) => i.paidCents >= i.amountCents);
  const downPaid =
    contract.downPaymentPaidCents + (isDown ? input.amountCents : BigInt(0)) >=
    contract.downPaymentCents;
  if (allInstallmentsPaid && downPaid) {
    await ctx.tx
      .update(creditContracts)
      .set({ state: 'completed', completedAt: new Date() })
      .where(eq(creditContracts.id, contract.id));
    await audit(ctx, {
      entity: 'credit_sales.contract',
      recordId: contract.id,
      action: 'complete',
      before: { state: 'active' },
      after: { state: 'completed' },
    });
  }

  await audit(ctx, {
    entity: 'credit_sales.receipt',
    recordId: receipt.id,
    action: 'create',
    after: { number: receiptNumber, paymentId: payment.id },
  });

  await emit(ctx, {
    name: 'credit_sales.payment.recorded',
    payload: {
      contractId: contract.id,
      partnerId: contract.partnerId,
      paymentId: payment.id,
      amountCents: input.amountCents.toString(),
    },
  });

  return ok({ paymentId: payment.id, receiptId: receipt.id, receiptNumber });
}

export async function listOverdue(
  ctx: Ctx,
  opts?: { limit?: number; partnerId?: string },
): Promise<OverdueRow[]> {
  const today = todayAlgiers();
  const conditions: SQL[] = [
    eq(creditContracts.state, 'active'),
    sql`${creditInstallments.paidCents} < ${creditInstallments.amountCents}`,
    lt(creditInstallments.dueDate, today),
  ];
  if (opts?.partnerId) conditions.push(eq(creditContracts.partnerId, opts.partnerId));
  return overdueQuery(ctx, conditions, opts?.limit ?? 500, today);
}

/** Open installments due from today up to `days` days ahead (Africa/Algiers). */
export async function listDueSoon(ctx: Ctx, days: number): Promise<OverdueRow[]> {
  const today = todayAlgiers();
  const conditions: SQL[] = [
    eq(creditContracts.state, 'active'),
    sql`${creditInstallments.paidCents} < ${creditInstallments.amountCents}`,
    gte(creditInstallments.dueDate, today),
    lte(creditInstallments.dueDate, addDays(today, days)),
  ];
  return overdueQuery(ctx, conditions, 500, today);
}

async function overdueQuery(
  ctx: Ctx,
  conditions: SQL[],
  limit: number,
  today: string,
): Promise<OverdueRow[]> {
  const rows = await ctx.tx
    .select({
      contractId: creditContracts.id,
      contractNumber: creditContracts.reference,
      partnerId: creditContracts.partnerId,
      partnerName: partners.displayName,
      partnerPhone: partners.phone,
      installmentId: creditInstallments.id,
      seq: creditInstallments.seq,
      dueDate: creditInstallments.dueDate,
      amountCents: creditInstallments.amountCents,
      paidCents: creditInstallments.paidCents,
    })
    .from(creditInstallments)
    .innerJoin(creditContracts, eq(creditContracts.id, creditInstallments.contractId))
    .innerJoin(partners, eq(partners.id, creditContracts.partnerId))
    .where(and(...conditions))
    .orderBy(asc(creditInstallments.dueDate), asc(partners.displayName), asc(creditInstallments.seq))
    .limit(limit);

  return rows.map((r) => ({
    contractId: r.contractId,
    contractNumber: r.contractNumber,
    partnerId: r.partnerId,
    partnerName: r.partnerName,
    partnerPhone: r.partnerPhone ?? null,
    installmentId: r.installmentId,
    seq: r.seq,
    dueDate: r.dueDate,
    dueCents: r.amountCents - r.paidCents,
    daysLate: Math.max(0, daysBetween(r.dueDate, today)),
  }));
}

/** Rows carry: id, receivedAt, partnerName, contractNumber, amountCents, method, receiptNumber, receiptId. */
export async function listPayments(ctx: Ctx, q: ListQuery): Promise<ListResult<Row>> {
  const pageSize = Math.min(Math.max(q.pageSize, 1), 100);
  const page = Math.max(q.page, 1);

  const conditions: SQL[] = [];
  const term = q.q?.trim();
  if (term) {
    const pattern = `%${term}%`;
    const match = or(
      ilike(partners.displayName, pattern),
      ilike(creditReceipts.number, pattern),
      ilike(creditPayments.reference, pattern),
    );
    if (match) conditions.push(match);
  }
  const method = q.filters?.method;
  if (method) conditions.push(eq(creditPayments.method, method));

  const contractRef = sql<string | null>`(
    select c.reference
    from ${creditPaymentAllocations} a
    left join ${creditInstallments} i on i.id = a.installment_id
    join ${creditContracts} c on c.id = coalesce(a.contract_id, i.contract_id)
    where a.payment_id = ${creditPayments.id}
    limit 1
  )`;

  const where = conditions.length ? and(...conditions) : undefined;
  const [countRow] = await ctx.tx
    .select({ total: count() })
    .from(creditPayments)
    .innerJoin(partners, eq(partners.id, creditPayments.partnerId))
    .leftJoin(creditReceipts, eq(creditReceipts.paymentId, creditPayments.id))
    .where(where);

  const rows = await ctx.tx
    .select({
      id: creditPayments.id,
      reference: creditPayments.reference,
      receivedAt: creditPayments.receivedAt,
      partnerName: partners.displayName,
      contractNumber: contractRef,
      amountCents: creditPayments.amountCents,
      method: creditPayments.method,
      receiptNumber: creditReceipts.number,
      receiptId: creditReceipts.id,
    })
    .from(creditPayments)
    .innerJoin(partners, eq(partners.id, creditPayments.partnerId))
    .leftJoin(creditReceipts, eq(creditReceipts.paymentId, creditPayments.id))
    .where(where)
    .orderBy(desc(creditPayments.receivedAt), desc(creditPayments.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      receivedAt: r.receivedAt.toISOString(),
      partnerName: r.partnerName,
      partnerIdLabel: r.partnerName,
      contractNumber: r.contractNumber,
      amountCents: r.amountCents.toString(),
      method: r.method,
      receiptNumber: r.receiptNumber,
      receiptId: r.receiptId,
    })),
    total: Number(countRow?.total ?? 0),
    page,
    pageSize,
  };
}
