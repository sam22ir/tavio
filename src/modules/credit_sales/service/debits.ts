// CCP direct debit service. Permission checks live in the actions (credit_sales.payment.read / .write).
// An item is one installment in one monthly batch. Money is only recorded through recordPayment (method 'ccp'),
// so receipts, allocations and the contract's completion all behave as for any other payment.
import { and, asc, count, desc, eq, inArray, lte, sql } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { err, ok, type Result } from '@/core/result';
import { audit } from '@/core/audit';
import { nextNumber } from '@/core/sequences';
import { partners } from '@/modules/contacts/schema';
import {
  creditContracts,
  creditDebitBatches,
  creditDebitItems,
  creditDebitMandates,
  creditInstallments,
} from '../schema';
import {
  buildDebitCsv,
  maskCcpAccount,
  monthBounds,
  normalizeCcpAccount,
  parseResultCsv,
  type DebitResultError,
} from './debit-file';
import { recordPayment } from './payments';

export type DebitItemStatus = 'pending' | 'paid' | 'rejected' | 'needs_review' | 'cancelled';
export type DebitBatchStatus = 'draft' | 'exported' | 'closed' | 'cancelled';

export interface DebitItemRow {
  id: string;
  reference: string;
  contractId: string;
  contractReference: string;
  partnerName: string;
  ccpAccount: string;
  amountCents: bigint;
  dueDate: string;
  status: DebitItemStatus;
  reason: string | null;
  settledOn: string | null;
}

export interface DebitBatchSummary {
  id: string;
  number: string;
  periodMonth: string;
  status: DebitBatchStatus;
  totalCents: bigint;
  items: number;
  pending: number;
  paid: number;
  rejected: number;
  needsReview: number;
}

export type SettleOutcome = 'paid' | 'rejected' | 'needs_review';

function todayAlgiers(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(new Date());
}

/** Noon in Algiers, so the day shown on the receipt is the settlement day. */
function receivedAtFor(day: string): string {
  return `${day}T12:00:00+01:00`;
}

// ---------------------------------------------------------------- mandates

export async function saveMandate(
  ctx: Ctx,
  input: { contractId: string; ccpAccount: string; signedOn: string },
): Promise<Result<{ id: string }>> {
  const account = normalizeCcpAccount(input.ccpAccount);
  if (!account) return err('VALIDATION', 'INVALID_CCP_ACCOUNT');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.signedOn)) return err('VALIDATION', 'INVALID_DATE');

  const [contract] = await ctx.tx
    .select({ id: creditContracts.id, partnerId: creditContracts.partnerId })
    .from(creditContracts)
    .where(eq(creditContracts.id, input.contractId));
  if (!contract) return err('NOT_FOUND', 'CONTRACT_NOT_FOUND');

  const [existing] = await ctx.tx
    .select({ id: creditDebitMandates.id, ccpAccount: creditDebitMandates.ccpAccount })
    .from(creditDebitMandates)
    .where(eq(creditDebitMandates.contractId, contract.id));

  if (existing) {
    await ctx.tx
      .update(creditDebitMandates)
      .set({ ccpAccount: account, signedOn: input.signedOn, active: true, updatedAt: new Date() })
      .where(eq(creditDebitMandates.id, existing.id));
    await audit(ctx, {
      entity: 'credit_sales.debit_mandate',
      recordId: existing.id,
      action: 'update',
      before: { ccpAccount: maskCcpAccount(existing.ccpAccount) },
      after: { ccpAccount: maskCcpAccount(account), signedOn: input.signedOn, active: true },
    });
    return ok({ id: existing.id });
  }

  const [row] = await ctx.tx
    .insert(creditDebitMandates)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      contractId: contract.id,
      partnerId: contract.partnerId,
      ccpAccount: account,
      signedOn: input.signedOn,
    })
    .returning({ id: creditDebitMandates.id });
  if (!row) throw new Error('mandate insert returned no row');
  await audit(ctx, {
    entity: 'credit_sales.debit_mandate',
    recordId: row.id,
    action: 'create',
    after: { contractId: contract.id, ccpAccount: maskCcpAccount(account), signedOn: input.signedOn },
  });
  return ok({ id: row.id });
}

export async function deactivateMandate(ctx: Ctx, contractId: string): Promise<Result<{ id: string }>> {
  const [row] = await ctx.tx
    .update(creditDebitMandates)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(creditDebitMandates.contractId, contractId))
    .returning({ id: creditDebitMandates.id });
  if (!row) return err('NOT_FOUND', 'MANDATE_NOT_FOUND');
  await audit(ctx, {
    entity: 'credit_sales.debit_mandate',
    recordId: row.id,
    action: 'update',
    before: { active: true },
    after: { active: false },
  });
  return ok({ id: row.id });
}

export async function getMandate(
  ctx: Ctx,
  contractId: string,
): Promise<{ id: string; ccpAccount: string; signedOn: string; active: boolean } | null> {
  const [row] = await ctx.tx
    .select({
      id: creditDebitMandates.id,
      ccpAccount: creditDebitMandates.ccpAccount,
      signedOn: creditDebitMandates.signedOn,
      active: creditDebitMandates.active,
    })
    .from(creditDebitMandates)
    .where(eq(creditDebitMandates.contractId, contractId));
  return row ?? null;
}

/** Debits of a contract still waiting for a result, and rejected ones: shown on the contract page and the payment dialog. */
export async function contractDebitState(
  ctx: Ctx,
  contractId: string,
): Promise<{ open: number; rejected: number; lastRejectReason: string | null }> {
  const rows = await ctx.tx
    .select({ status: creditDebitItems.status, reason: creditDebitItems.reason, updatedAt: creditDebitItems.updatedAt })
    .from(creditDebitItems)
    .where(eq(creditDebitItems.contractId, contractId))
    .orderBy(desc(creditDebitItems.updatedAt));
  const rejected = rows.filter((r) => r.status === 'rejected');
  return {
    open: rows.filter((r) => r.status === 'pending' || r.status === 'needs_review').length,
    rejected: rejected.length,
    lastRejectReason: rejected[0]?.reason ?? null,
  };
}

// ----------------------------------------------------------------- batches

/** Installments due on or before the end of the month, on active contracts with an active mandate, not already in an open batch. */
export async function createBatch(ctx: Ctx, input: { month: string }): Promise<Result<{ id: string; number: string; items: number }>> {
  const bounds = monthBounds(input.month);
  if (!bounds) return err('VALIDATION', 'INVALID_MONTH');

  const eligible = await ctx.tx
    .select({
      installmentId: creditInstallments.id,
      contractId: creditInstallments.contractId,
      partnerId: creditContracts.partnerId,
      amountCents: sql<bigint>`${creditInstallments.amountCents} - ${creditInstallments.paidCents}`,
      ccpAccount: creditDebitMandates.ccpAccount,
      dueDate: creditInstallments.dueDate,
    })
    .from(creditInstallments)
    .innerJoin(creditContracts, eq(creditContracts.id, creditInstallments.contractId))
    .innerJoin(creditDebitMandates, eq(creditDebitMandates.contractId, creditContracts.id))
    .where(
      and(
        eq(creditContracts.state, 'active'),
        eq(creditDebitMandates.active, true),
        lte(creditInstallments.dueDate, bounds.last),
        sql`${creditInstallments.paidCents} < ${creditInstallments.amountCents}`,
        sql`not exists (
          select 1 from ${creditDebitItems} di
          where di.installment_id = ${creditInstallments.id} and di.status in ('pending', 'needs_review')
        )`,
      ),
    )
    .orderBy(asc(creditInstallments.contractId), asc(creditInstallments.dueDate), asc(creditInstallments.seq));

  if (eligible.length === 0) return err('VALIDATION', 'NO_ELIGIBLE_INSTALLMENTS');

  const number = await nextNumber(ctx, 'credit_sales.debit_batch', { prefix: 'PRV-{YYYY}-' });
  const total = eligible.reduce((sum, r) => sum + BigInt(r.amountCents), BigInt(0));
  const [batch] = await ctx.tx
    .insert(creditDebitBatches)
    .values({ companyId: ctx.companyId, createdBy: ctx.userId, number, periodMonth: bounds.first, totalCents: total })
    .returning({ id: creditDebitBatches.id });
  if (!batch) throw new Error('batch insert returned no row');

  await ctx.tx.insert(creditDebitItems).values(
    eligible.map((r, i) => ({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      batchId: batch.id,
      installmentId: r.installmentId,
      contractId: r.contractId,
      partnerId: r.partnerId,
      reference: `${number}-${String(i + 1).padStart(3, '0')}`,
      amountCents: BigInt(r.amountCents),
      ccpAccount: r.ccpAccount,
    })),
  );

  await audit(ctx, {
    entity: 'credit_sales.debit_batch',
    recordId: batch.id,
    action: 'create',
    after: { number, periodMonth: bounds.first, items: eligible.length, totalCents: total },
  });
  return ok({ id: batch.id, number, items: eligible.length });
}

export async function listBatches(ctx: Ctx): Promise<DebitBatchSummary[]> {
  const rows = await ctx.tx
    .select({
      id: creditDebitBatches.id,
      number: creditDebitBatches.number,
      periodMonth: creditDebitBatches.periodMonth,
      status: creditDebitBatches.status,
      totalCents: creditDebitBatches.totalCents,
      items: count(creditDebitItems.id),
      pending: sql<number>`count(*) filter (where ${creditDebitItems.status} = 'pending')`,
      paid: sql<number>`count(*) filter (where ${creditDebitItems.status} = 'paid')`,
      rejected: sql<number>`count(*) filter (where ${creditDebitItems.status} = 'rejected')`,
      needsReview: sql<number>`count(*) filter (where ${creditDebitItems.status} = 'needs_review')`,
    })
    .from(creditDebitBatches)
    .leftJoin(creditDebitItems, eq(creditDebitItems.batchId, creditDebitBatches.id))
    .groupBy(creditDebitBatches.id)
    .orderBy(desc(creditDebitBatches.periodMonth), desc(creditDebitBatches.number));
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    periodMonth: r.periodMonth,
    status: r.status as DebitBatchStatus,
    totalCents: r.totalCents,
    items: Number(r.items),
    pending: Number(r.pending),
    paid: Number(r.paid),
    rejected: Number(r.rejected),
    needsReview: Number(r.needsReview),
  }));
}

export async function getBatch(
  ctx: Ctx,
  id: string,
): Promise<{ batch: DebitBatchSummary; items: DebitItemRow[] } | null> {
  const [header] = (await listBatches(ctx)).filter((b) => b.id === id);
  if (!header) return null;
  const items = await ctx.tx
    .select({
      id: creditDebitItems.id,
      reference: creditDebitItems.reference,
      contractId: creditDebitItems.contractId,
      contractReference: creditContracts.reference,
      partnerName: partners.displayName,
      ccpAccount: creditDebitItems.ccpAccount,
      amountCents: creditDebitItems.amountCents,
      dueDate: creditInstallments.dueDate,
      status: creditDebitItems.status,
      reason: creditDebitItems.reason,
      settledOn: creditDebitItems.settledOn,
    })
    .from(creditDebitItems)
    .innerJoin(creditContracts, eq(creditContracts.id, creditDebitItems.contractId))
    .innerJoin(creditInstallments, eq(creditInstallments.id, creditDebitItems.installmentId))
    .innerJoin(partners, eq(partners.id, creditDebitItems.partnerId))
    .where(eq(creditDebitItems.batchId, id))
    .orderBy(asc(creditDebitItems.reference));
  return { batch: header, items: items.map((i) => ({ ...i, status: i.status as DebitItemStatus })) };
}

/** The file for the postal debit run. Revora's own template (see debit-file.ts). Marks a draft batch as exported. */
export async function exportBatch(ctx: Ctx, id: string): Promise<Result<{ number: string; csv: string }>> {
  const data = await getBatch(ctx, id);
  if (!data) return err('NOT_FOUND', 'BATCH_NOT_FOUND');
  if (data.batch.status === 'cancelled') return err('STATE', 'BATCH_CANCELLED');
  const csv = buildDebitCsv(
    data.items
      .filter((i) => i.status === 'pending' || i.status === 'needs_review')
      .map((i) => ({
        reference: i.reference,
        contract: i.contractReference,
        customer: i.partnerName,
        ccpAccount: i.ccpAccount,
        amountCents: i.amountCents,
        dueDate: i.dueDate,
      })),
  );
  if (data.batch.status === 'draft') {
    await ctx.tx
      .update(creditDebitBatches)
      .set({ status: 'exported', exportedAt: new Date(), updatedAt: new Date() })
      .where(eq(creditDebitBatches.id, id));
    await audit(ctx, {
      entity: 'credit_sales.debit_batch',
      recordId: id,
      action: 'export',
      before: { status: 'draft' },
      after: { status: 'exported' },
    });
  }
  return ok({ number: data.batch.number, csv });
}

// ------------------------------------------------------------------- items

/**
 * Records the outcome of one debit. A debit that went through but cannot be posted (the installment was settled meanwhile,
 * or the contract is no longer active) is NOT dropped: the customer's money has moved, so the item is kept as needs_review.
 */
export async function settleItem(
  ctx: Ctx,
  input: { itemId: string; outcome: 'paid' | 'rejected'; settledOn?: string; reason?: string },
): Promise<Result<{ outcome: SettleOutcome; code?: string }>> {
  const settledOn = input.settledOn ?? todayAlgiers();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(settledOn)) return err('VALIDATION', 'INVALID_DATE');

  const [item] = await ctx.tx
    .select()
    .from(creditDebitItems)
    .where(eq(creditDebitItems.id, input.itemId))
    .for('update');
  if (!item) return err('NOT_FOUND', 'ITEM_NOT_FOUND');
  if (item.status !== 'pending' && item.status !== 'needs_review') return err('STATE', 'ITEM_ALREADY_SETTLED');

  const [batch] = await ctx.tx
    .select({ status: creditDebitBatches.status })
    .from(creditDebitBatches)
    .where(eq(creditDebitBatches.id, item.batchId));
  if (!batch || batch.status === 'closed' || batch.status === 'cancelled') return err('STATE', 'BATCH_NOT_OPEN');

  if (input.outcome === 'rejected') {
    await ctx.tx
      .update(creditDebitItems)
      .set({ status: 'rejected', reason: input.reason?.trim() || null, settledOn, updatedAt: new Date() })
      .where(eq(creditDebitItems.id, item.id));
    await audit(ctx, {
      entity: 'credit_sales.debit_item',
      recordId: item.id,
      action: 'reject',
      before: { status: item.status },
      after: { status: 'rejected', reason: input.reason?.trim() || null, settledOn },
    });
    return ok({ outcome: 'rejected' });
  }

  const [inst] = await ctx.tx
    .select({ amountCents: creditInstallments.amountCents, paidCents: creditInstallments.paidCents })
    .from(creditInstallments)
    .where(eq(creditInstallments.id, item.installmentId));
  const open = inst ? inst.amountCents - inst.paidCents : BigInt(0);

  let code: string | undefined;
  let paymentId: string | undefined;
  if (item.amountCents > open) {
    code = 'ALREADY_SETTLED_ELSEWHERE';
  } else {
    const posted = await recordPayment(ctx, {
      contractId: item.contractId,
      amountCents: item.amountCents,
      method: 'ccp',
      receivedAt: receivedAtFor(settledOn),
      reference: item.reference,
    });
    if (posted.ok) paymentId = posted.value.paymentId;
    else code = posted.error.message;
  }

  if (!paymentId) {
    await ctx.tx
      .update(creditDebitItems)
      .set({ status: 'needs_review', reason: code ?? 'NOT_POSTED', settledOn, updatedAt: new Date() })
      .where(eq(creditDebitItems.id, item.id));
    await audit(ctx, {
      entity: 'credit_sales.debit_item',
      recordId: item.id,
      action: 'needs_review',
      before: { status: item.status },
      after: { status: 'needs_review', reason: code ?? 'NOT_POSTED', settledOn },
    });
    return ok({ outcome: 'needs_review', code });
  }

  await ctx.tx
    .update(creditDebitItems)
    .set({ status: 'paid', paymentId, reason: null, settledOn, updatedAt: new Date() })
    .where(eq(creditDebitItems.id, item.id));
  await audit(ctx, {
    entity: 'credit_sales.debit_item',
    recordId: item.id,
    action: 'pay',
    before: { status: item.status },
    after: { status: 'paid', paymentId, settledOn },
  });
  return ok({ outcome: 'paid' });
}

/** Marks every pending item of a batch as paid on the given day. Items that cannot be posted become needs_review. */
export async function markRemainingPaid(
  ctx: Ctx,
  input: { batchId: string; settledOn?: string },
): Promise<Result<{ paid: number; needsReview: number }>> {
  const items = await ctx.tx
    .select({ id: creditDebitItems.id })
    .from(creditDebitItems)
    .where(and(eq(creditDebitItems.batchId, input.batchId), eq(creditDebitItems.status, 'pending')))
    .orderBy(asc(creditDebitItems.reference));
  let paid = 0;
  let needsReview = 0;
  for (const item of items) {
    const r = await settleItem(ctx, { itemId: item.id, outcome: 'paid', settledOn: input.settledOn });
    if (!r.ok) return r;
    if (r.value.outcome === 'paid') paid++;
    else needsReview++;
  }
  return ok({ paid, needsReview });
}

export interface ImportSummary {
  paid: number;
  rejected: number;
  needsReview: number;
  skipped: number;
  unknown: string[];
  errors: DebitResultError[];
}

/**
 * Secondary path: apply a result file (`reference;status[;reason[;date]]`). Each row runs in its own savepoint so one bad row
 * does not undo the others. Rows for items that are already settled are skipped, so the same file can be loaded twice.
 */
export async function importResults(ctx: Ctx, input: { batchId: string; text: string }): Promise<Result<ImportSummary>> {
  const parsed = parseResultCsv(input.text);
  if (parsed.tooMany) return err('VALIDATION', 'TOO_MANY_ROWS');
  if (parsed.rows.length === 0 && parsed.errors.length === 0) return err('VALIDATION', 'EMPTY_FILE');

  const items = await ctx.tx
    .select({ id: creditDebitItems.id, reference: creditDebitItems.reference, status: creditDebitItems.status })
    .from(creditDebitItems)
    .where(
      and(
        eq(creditDebitItems.batchId, input.batchId),
        inArray(creditDebitItems.reference, parsed.rows.map((r) => r.reference)),
      ),
    );
  const byRef = new Map(items.map((i) => [i.reference, i]));

  const summary: ImportSummary = { paid: 0, rejected: 0, needsReview: 0, skipped: 0, unknown: [], errors: parsed.errors };
  for (const row of parsed.rows) {
    const item = byRef.get(row.reference);
    if (!item) {
      summary.unknown.push(row.reference);
      continue;
    }
    if (item.status !== 'pending' && item.status !== 'needs_review') {
      summary.skipped++;
      continue;
    }
    const result = await ctx.tx.transaction(async (tx) =>
      settleItem(
        { ...ctx, tx },
        { itemId: item.id, outcome: row.status, settledOn: row.settledOn ?? undefined, reason: row.reason ?? undefined },
      ),
    );
    if (!result.ok) {
      summary.errors.push({ line: 0, message: `${row.reference}: ${result.error.message}` });
      continue;
    }
    if (result.value.outcome === 'paid') summary.paid++;
    else if (result.value.outcome === 'rejected') summary.rejected++;
    else summary.needsReview++;
  }
  return ok(summary);
}

/** Drops a debit that could not be posted (or is no longer wanted) so its installment can go into a later batch. */
export async function dismissItem(ctx: Ctx, itemId: string): Promise<Result<{ id: string }>> {
  const [item] = await ctx.tx.select().from(creditDebitItems).where(eq(creditDebitItems.id, itemId)).for('update');
  if (!item) return err('NOT_FOUND', 'ITEM_NOT_FOUND');
  if (item.status !== 'needs_review' && item.status !== 'pending') return err('STATE', 'ITEM_ALREADY_SETTLED');
  await ctx.tx
    .update(creditDebitItems)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(creditDebitItems.id, itemId));
  await audit(ctx, {
    entity: 'credit_sales.debit_item',
    recordId: itemId,
    action: 'cancel',
    before: { status: item.status, reason: item.reason },
    after: { status: 'cancelled' },
  });
  return ok({ id: itemId });
}

/** Closes a batch once every item has a result. Needs-review items must be resolved (posted by hand or dismissed) first. */
export async function closeBatch(ctx: Ctx, id: string): Promise<Result<{ id: string }>> {
  const data = await getBatch(ctx, id);
  if (!data) return err('NOT_FOUND', 'BATCH_NOT_FOUND');
  if (data.batch.status === 'closed' || data.batch.status === 'cancelled') return err('STATE', 'BATCH_NOT_OPEN');
  if (data.batch.pending > 0 || data.batch.needsReview > 0) return err('STATE', 'ITEMS_STILL_OPEN');
  await ctx.tx
    .update(creditDebitBatches)
    .set({ status: 'closed', closedAt: new Date(), updatedAt: new Date() })
    .where(eq(creditDebitBatches.id, id));
  await audit(ctx, {
    entity: 'credit_sales.debit_batch',
    recordId: id,
    action: 'close',
    before: { status: data.batch.status },
    after: { status: 'closed' },
  });
  return ok({ id });
}

/** Cancels a batch made by mistake. Refused once any debit has been posted. */
export async function cancelBatch(ctx: Ctx, id: string): Promise<Result<{ id: string }>> {
  const data = await getBatch(ctx, id);
  if (!data) return err('NOT_FOUND', 'BATCH_NOT_FOUND');
  if (data.batch.status === 'closed' || data.batch.status === 'cancelled') return err('STATE', 'BATCH_NOT_OPEN');
  if (data.batch.paid > 0) return err('STATE', 'BATCH_HAS_PAYMENTS');
  await ctx.tx
    .update(creditDebitItems)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(
      and(eq(creditDebitItems.batchId, id), inArray(creditDebitItems.status, ['pending', 'needs_review'])),
    );
  await ctx.tx
    .update(creditDebitBatches)
    .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
    .where(eq(creditDebitBatches.id, id));
  await audit(ctx, {
    entity: 'credit_sales.debit_batch',
    recordId: id,
    action: 'cancel',
    before: { status: data.batch.status },
    after: { status: 'cancelled' },
  });
  return ok({ id });
}
