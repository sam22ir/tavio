// Contracts service (W4-E). Signatures are frozen.
import { and, asc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { emit } from '@/core/events';
import type { ListQuery, ListResult, Row } from '@/core/entities/types';
import { applyRate, roundHalfUp, sumCents, type Cents } from '@/core/money';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { nextNumber } from '@/core/sequences';
import { postMessage } from '@/modules/chatter/service';
import { partners } from '@/modules/contacts/schema';
import {
  creditContracts,
  creditContractLines,
  creditInstallments,
  creditPayments,
  creditPaymentAllocations,
  creditReceipts,
} from '../schema';
import { buildSchedule, isIsoDate, type ScheduleLine } from './schedule';
import { CONTRACT_STATES, canTransition, transitionContract } from './transitions';

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

const ENTITY = 'credit_sales.contract';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QTY_RE = /^\d+(\.\d{1,3})?$/;
const RATE_RE = /^\d+(\.\d{1,4})?$/;
const MAX_INSTALLMENTS = 120;
const THOUSAND = BigInt(1000);
const ZERO = BigInt(0);
const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Algiers',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

type ContractRow = typeof creditContracts.$inferSelect;
type InstallmentRow = typeof creditInstallments.$inferSelect;

interface ComputedLine {
  productId: string | null;
  description: string;
  quantity: string;
  unitPriceCents: Cents;
  lineTotalCents: Cents;
}
interface ComputedDraft {
  partnerId: string;
  leadId: string | null;
  lines: ComputedLine[];
  cashPriceCents: Cents;
  markupRate: string;
  markupCents: Cents;
  totalCents: Cents;
  downPaymentCents: Cents;
  financedCents: Cents;
  frequency: Frequency;
  installmentsCount: number;
  startDate: string;
  notes: string | null;
}

function todayInAlgiers(): string {
  return DAY_FORMAT.format(new Date());
}

/** quantity "1.5" becomes 1500 thousandths, without floats. Input is already validated. */
function quantityThousandths(quantity: string): Cents {
  const [whole = '0', frac = ''] = quantity.split('.');
  return BigInt(whole) * THOUSAND + BigInt((frac + '000').slice(0, 3));
}

function installmentStatus(paid: Cents, amount: Cents, dueDate: string, today: string): InstallmentStatus {
  if (paid >= amount) return 'paid';
  if (dueDate < today) return 'late';
  return paid > ZERO ? 'partial' : 'upcoming';
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Validates the draft input and computes all money fields. Returns VALIDATION or NOT_FOUND for the partner. */
async function computeDraft(ctx: Ctx, input: DraftContractInput): Promise<Result<ComputedDraft>> {
  if (!UUID_RE.test(input.partnerId)) return err('VALIDATION', 'partnerId must be a UUID', { field: 'partnerId' });
  if (input.leadId !== undefined && !UUID_RE.test(input.leadId)) {
    return err('VALIDATION', 'leadId must be a UUID', { field: 'leadId' });
  }
  if (input.lines.length < 1) return err('VALIDATION', 'A contract needs at least one line', { field: 'lines' });
  if (!Number.isInteger(input.installmentsCount) || input.installmentsCount < 1 || input.installmentsCount > MAX_INSTALLMENTS) {
    return err('VALIDATION', `installmentsCount must be between 1 and ${MAX_INSTALLMENTS}`, { field: 'installmentsCount' });
  }
  if (input.frequency !== 'monthly' && input.frequency !== 'weekly') {
    return err('VALIDATION', 'frequency must be monthly or weekly', { field: 'frequency' });
  }
  if (!isIsoDate(input.startDate)) return err('VALIDATION', 'startDate must be a YYYY-MM-DD date', { field: 'startDate' });
  if (!RATE_RE.test(input.markupRate)) return err('VALIDATION', 'markupRate must be a percent with up to 4 decimals', { field: 'markupRate' });

  const lines: ComputedLine[] = [];
  for (const [index, line] of input.lines.entries()) {
    const description = line.description.trim();
    if (description === '') return err('VALIDATION', `Line ${index + 1} needs a description`, { field: 'lines' });
    if (!QTY_RE.test(line.quantity) || quantityThousandths(line.quantity) <= ZERO) {
      return err('VALIDATION', `Line ${index + 1} quantity must be > 0 with up to 3 decimals`, { field: 'lines' });
    }
    if (line.unitPriceCents < ZERO) return err('VALIDATION', `Line ${index + 1} unit price must be >= 0`, { field: 'lines' });
    if (line.productId !== undefined && !UUID_RE.test(line.productId)) {
      return err('VALIDATION', `Line ${index + 1} productId must be a UUID`, { field: 'lines' });
    }
    lines.push({
      productId: line.productId ?? null,
      description,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      lineTotalCents: roundHalfUp(quantityThousandths(line.quantity) * line.unitPriceCents, THOUSAND),
    });
  }

  const cashPriceCents = sumCents(lines.map((l) => l.lineTotalCents));
  if (input.downPaymentCents < ZERO) return err('VALIDATION', 'Down payment must be >= 0', { field: 'downPaymentCents' });
  // Markup is charged on cash - down, so the down payment cannot exceed the cash price.
  if (input.downPaymentCents > cashPriceCents) {
    return err('VALIDATION', 'Down payment cannot exceed the cash price', { field: 'downPaymentCents' });
  }

  const [partner] = await ctx.tx
    .select({ id: partners.id, isCustomer: partners.isCustomer })
    .from(partners)
    .where(and(eq(partners.id, input.partnerId), eq(partners.companyId, ctx.companyId)));
  if (!partner) return err('NOT_FOUND', 'Partner not found');
  if (!partner.isCustomer) return err('VALIDATION', 'Partner is not a customer', { field: 'partnerId' });

  const markupCents = applyRate(cashPriceCents - input.downPaymentCents, input.markupRate);
  const totalCents = cashPriceCents + markupCents;
  return ok({
    partnerId: input.partnerId,
    leadId: input.leadId ?? null,
    lines,
    cashPriceCents,
    markupRate: input.markupRate,
    markupCents,
    totalCents,
    downPaymentCents: input.downPaymentCents,
    financedCents: totalCents - input.downPaymentCents,
    frequency: input.frequency,
    installmentsCount: input.installmentsCount,
    startDate: input.startDate,
    notes: input.notes?.trim() || null,
  });
}

function lineRows(ctx: Ctx, contractId: string, lines: ComputedLine[]): typeof creditContractLines.$inferInsert[] {
  return lines.map((line, index) => ({
    companyId: ctx.companyId,
    createdBy: ctx.userId,
    contractId,
    lineNo: index + 1,
    productId: line.productId,
    description: line.description,
    quantity: line.quantity,
    unitPriceCents: line.unitPriceCents,
    lineTotalCents: line.lineTotalCents,
  }));
}

export async function loadContractForUpdate(ctx: Ctx, id: string): Promise<Result<ContractRow>> {
  if (!UUID_RE.test(id)) return err('NOT_FOUND', 'Contract not found');
  const [row] = await ctx.tx
    .select()
    .from(creditContracts)
    .where(and(eq(creditContracts.id, id), eq(creditContracts.companyId, ctx.companyId)))
    .for('update');
  if (!row) return err('NOT_FOUND', 'Contract not found');
  return ok(row);
}

async function hasPayments(ctx: Ctx, contract: ContractRow): Promise<boolean> {
  if (contract.downPaymentPaidCents > ZERO) return true;
  const [paid] = await ctx.tx
    .select({ seq: creditInstallments.seq })
    .from(creditInstallments)
    .where(and(
      eq(creditInstallments.companyId, ctx.companyId),
      eq(creditInstallments.contractId, contract.id),
      sql`${creditInstallments.paidCents} > 0`,
    ))
    .limit(1);
  return paid !== undefined;
}

export async function createDraftContract(ctx: Ctx, input: DraftContractInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.write');
  if (!perm.ok) return perm;
  const draft = await computeDraft(ctx, input);
  if (!draft.ok) return draft;
  const d = draft.value;

  // Real number is assigned on activation, so the draft gets a unique placeholder reference.
  const [row] = await ctx.tx
    .insert(creditContracts)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      reference: `DRAFT-${crypto.randomUUID()}`,
      partnerId: d.partnerId,
      leadId: d.leadId,
      state: 'draft',
      salespersonId: ctx.userId,
      startDate: d.startDate,
      frequency: d.frequency,
      installmentsCount: d.installmentsCount,
      cashPriceCents: d.cashPriceCents,
      markupRate: d.markupRate,
      markupCents: d.markupCents,
      totalCents: d.totalCents,
      downPaymentCents: d.downPaymentCents,
      financedCents: d.financedCents,
      notes: d.notes,
    })
    .returning({ id: creditContracts.id });
  if (!row) return err('INTERNAL', 'Insert returned no row');

  await ctx.tx.insert(creditContractLines).values(lineRows(ctx, row.id, d.lines));
  await audit(ctx, {
    entity: ENTITY,
    recordId: row.id,
    action: 'create',
    after: { state: 'draft', partnerId: d.partnerId, cashPriceCents: d.cashPriceCents, totalCents: d.totalCents, financedCents: d.financedCents },
  });
  const posted = await postMessage(ctx, { entity: ENTITY, recordId: row.id, body: 'Draft contract created', kind: 'system' });
  if (!posted.ok) return posted;
  return ok({ id: row.id });
}

export async function updateDraftContract(ctx: Ctx, id: string, input: DraftContractInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.write');
  if (!perm.ok) return perm;
  const current = await loadContractForUpdate(ctx, id);
  if (!current.ok) return current;
  if (current.value.state !== 'draft') return err('STATE', 'Only draft contracts can be edited');
  const draft = await computeDraft(ctx, input);
  if (!draft.ok) return draft;
  const d = draft.value;

  await ctx.tx
    .update(creditContracts)
    .set({
      partnerId: d.partnerId,
      leadId: d.leadId,
      salespersonId: ctx.userId,
      startDate: d.startDate,
      frequency: d.frequency,
      installmentsCount: d.installmentsCount,
      cashPriceCents: d.cashPriceCents,
      markupRate: d.markupRate,
      markupCents: d.markupCents,
      totalCents: d.totalCents,
      downPaymentCents: d.downPaymentCents,
      financedCents: d.financedCents,
      notes: d.notes,
      updatedAt: new Date(),
    })
    .where(eq(creditContracts.id, id));
  await ctx.tx.delete(creditContractLines).where(eq(creditContractLines.contractId, id));
  await ctx.tx.insert(creditContractLines).values(lineRows(ctx, id, d.lines));
  await audit(ctx, {
    entity: ENTITY,
    recordId: id,
    action: 'update',
    before: { totalCents: current.value.totalCents, financedCents: current.value.financedCents },
    after: { totalCents: d.totalCents, financedCents: d.financedCents, lines: d.lines.length },
  });
  return ok({ id });
}

export async function activateContract(ctx: Ctx, id: string): Promise<Result<{ id: string; number: string }>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.activate');
  if (!perm.ok) return perm;
  const loaded = await loadContractForUpdate(ctx, id);
  if (!loaded.ok) return loaded;
  const contract = loaded.value;
  if (!canTransition(contract.state, 'active')) return err('STATE', 'Only draft or reserved contracts can be activated');

  // Check the schedule before taking a number, so a failed activation does not use one up.
  if (contract.financedCents <= ZERO) return err('VALIDATION', 'Nothing to finance');
  const schedule: ScheduleLine[] = buildSchedule({
    financedCents: contract.financedCents,
    count: contract.installmentsCount,
    frequency: contract.frequency as Frequency,
    firstDueDate: contract.startDate,
  });
  if (schedule.some((line) => line.amountCents <= ZERO)) {
    return err('VALIDATION', 'Installment count is larger than the financed amount in cents', { field: 'installmentsCount' });
  }

  const number = await nextNumber(ctx, ENTITY, { prefix: 'CR-{YYYY}-', padding: 5 });
  const moved = await transitionContract(ctx, contract, 'active', {
    action: 'activate',
    set: { reference: number, confirmedAt: new Date() },
    auditAfter: { reference: number, installments: schedule.length },
  });
  if (!moved.ok) return moved;
  await ctx.tx.insert(creditInstallments).values(
    schedule.map((line) => ({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      contractId: id,
      seq: line.seq,
      dueDate: line.dueDate,
      amountCents: line.amountCents,
      paidCents: ZERO,
    })),
  );
  await emit(ctx, {
    name: 'credit_sales.contract.activated',
    payload: {
      contractId: id,
      number,
      partnerId: contract.partnerId,
      cashPriceCents: contract.cashPriceCents.toString(),
      markupCents: contract.markupCents.toString(),
      downPaymentCents: contract.downPaymentCents.toString(),
      financedCents: contract.financedCents.toString(),
    },
  });
  const posted = await postMessage(ctx, { entity: ENTITY, recordId: id, body: `Contract ${number} activated`, kind: 'system' });
  if (!posted.ok) return posted;
  return ok({ id, number });
}

export async function cancelContract(ctx: Ctx, id: string, reason: string): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.cancel');
  if (!perm.ok) return perm;
  const cancelReason = reason.trim();
  if (cancelReason === '') return err('VALIDATION', 'A cancel reason is required', { field: 'reason' });
  const loaded = await loadContractForUpdate(ctx, id);
  if (!loaded.ok) return loaded;
  const contract = loaded.value;
  if (!canTransition(contract.state, 'cancelled')) {
    return err('STATE', 'This contract can no longer be cancelled');
  }
  if (!cancelReason.startsWith('force:') && (await hasPayments(ctx, contract))) {
    return err('STATE', 'Contract has payments; a reason starting with "force:" is needed to cancel it');
  }

  return transitionContract(ctx, contract, 'cancelled', {
    action: 'cancel',
    set: { cancelledAt: new Date(), cancelReason },
    auditAfter: { reason: cancelReason },
  });
}

export async function getContract(ctx: Ctx, id: string): Promise<Result<ContractDetail>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.read');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(id)) return err('NOT_FOUND', 'Contract not found');
  const [contract] = await ctx.tx
    .select()
    .from(creditContracts)
    .where(and(eq(creditContracts.id, id), eq(creditContracts.companyId, ctx.companyId)));
  if (!contract) return err('NOT_FOUND', 'Contract not found');

  const [partner] = await ctx.tx
    .select({ id: partners.id, displayName: partners.displayName, phone: partners.phone })
    .from(partners)
    .where(and(eq(partners.id, contract.partnerId), eq(partners.companyId, ctx.companyId)));
  const lines = await ctx.tx
    .select()
    .from(creditContractLines)
    .where(and(eq(creditContractLines.companyId, ctx.companyId), eq(creditContractLines.contractId, id)))
    .orderBy(asc(creditContractLines.lineNo));
  const rawInstallments: InstallmentRow[] = await ctx.tx
    .select()
    .from(creditInstallments)
    .where(and(eq(creditInstallments.companyId, ctx.companyId), eq(creditInstallments.contractId, id)))
    .orderBy(asc(creditInstallments.seq));

  const today = todayInAlgiers();
  const installments = rawInstallments.map((row) => ({
    ...row,
    status: installmentStatus(row.paidCents, row.amountCents, row.dueDate, today),
  }));

  // Payments link to a contract through allocations (down payment to the contract, the rest to installments).
  const installmentIds = rawInstallments.map((row) => row.id);
  const allocationTarget: SQL = installmentIds.length > 0
    ? or(eq(creditPaymentAllocations.contractId, id), inArray(creditPaymentAllocations.installmentId, installmentIds)) ?? eq(creditPaymentAllocations.contractId, id)
    : eq(creditPaymentAllocations.contractId, id);
  const allocations = await ctx.tx
    .select({ paymentId: creditPaymentAllocations.paymentId })
    .from(creditPaymentAllocations)
    .where(and(eq(creditPaymentAllocations.companyId, ctx.companyId), allocationTarget));
  const paymentIds = [...new Set(allocations.map((a) => a.paymentId))];
  const payments = paymentIds.length > 0
    ? await ctx.tx
        .select()
        .from(creditPayments)
        .where(and(eq(creditPayments.companyId, ctx.companyId), inArray(creditPayments.id, paymentIds)))
        .orderBy(asc(creditPayments.receivedAt))
    : [];
  const receipts = paymentIds.length > 0
    ? await ctx.tx
        .select()
        .from(creditReceipts)
        .where(and(eq(creditReceipts.companyId, ctx.companyId), inArray(creditReceipts.paymentId, paymentIds)))
        .orderBy(asc(creditReceipts.issuedAt))
    : [];

  const paidCents = sumCents(rawInstallments.map((row) => row.paidCents));
  const lateCents = sumCents(
    installments
      .filter((row) => row.status === 'late')
      .map((row) => row.amountCents - row.paidCents),
  );

  return ok({
    contract,
    partner: {
      id: contract.partnerId,
      name: partner?.displayName ?? '',
      phone: partner?.phone ?? null,
    },
    lines,
    installments,
    payments,
    receipts,
    totals: {
      financedCents: contract.financedCents,
      paidCents,
      remainingCents: contract.financedCents - paidCents,
      lateCents,
    },
  });
}

/** Rows carry: id, number, state, partnerName, totalCents, remainingCents, nextDueDate, startDate. */
export async function listContracts(ctx: Ctx, q: ListQuery): Promise<ListResult<Row>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.read');
  if (!perm.ok) return { rows: [], total: 0, page: q.page, pageSize: q.pageSize };

  const page = Math.max(1, Math.floor(q.page));
  const pageSize = Math.min(100, Math.max(1, Math.floor(q.pageSize)));
  const conditions: SQL[] = [eq(creditContracts.companyId, ctx.companyId)];
  const search = q.q?.trim();
  if (search) {
    const pattern = `%${escapeLike(search)}%`;
    const match = or(ilike(creditContracts.reference, pattern), ilike(partners.displayName, pattern));
    if (match) conditions.push(match);
  }
  const state = q.filters.state;
  if (state && (CONTRACT_STATES as readonly string[]).includes(state)) {
    conditions.push(eq(creditContracts.state, state));
  }
  const where = and(...conditions);

  const [countRow] = await ctx.tx
    .select({ n: sql<number>`count(*)::int` })
    .from(creditContracts)
    .innerJoin(partners, eq(partners.id, creditContracts.partnerId))
    .where(where);
  const total = countRow?.n ?? 0;

  const pageRows = await ctx.tx
    .select({
      id: creditContracts.id,
      reference: creditContracts.reference,
      state: creditContracts.state,
      partnerName: partners.displayName,
      frequency: creditContracts.frequency,
      installmentsCount: creditContracts.installmentsCount,
      cashPriceCents: creditContracts.cashPriceCents,
      totalCents: creditContracts.totalCents,
      financedCents: creditContracts.financedCents,
      startDate: creditContracts.startDate,
    })
    .from(creditContracts)
    .innerJoin(partners, eq(partners.id, creditContracts.partnerId))
    .where(where)
    .orderBy(sql`${creditContracts.createdAt} desc`, asc(creditContracts.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const ids = pageRows.map((r) => r.id);
  const installmentRows = ids.length > 0
    ? await ctx.tx
        .select({
          contractId: creditInstallments.contractId,
          dueDate: creditInstallments.dueDate,
          amountCents: creditInstallments.amountCents,
          paidCents: creditInstallments.paidCents,
        })
        .from(creditInstallments)
        .where(and(eq(creditInstallments.companyId, ctx.companyId), inArray(creditInstallments.contractId, ids)))
    : [];

  const rows: Row[] = pageRows.map((r) => {
    const own = installmentRows.filter((i) => i.contractId === r.id);
    const paid = sumCents(own.map((i) => i.paidCents));
    const open = own.filter((i) => i.paidCents < i.amountCents).map((i) => i.dueDate).sort();
    return {
      id: r.id,
      reference: r.reference,
      state: r.state,
      partnerName: r.partnerName,
      frequency: r.frequency,
      installmentsCount: r.installmentsCount,
      cashPriceCents: r.cashPriceCents,
      totalCents: r.totalCents,
      remainingCents: r.financedCents - paid,
      nextDueDate: open[0] ?? null,
      startDate: r.startDate,
    };
  });
  return { rows, total, page, pageSize };
}
