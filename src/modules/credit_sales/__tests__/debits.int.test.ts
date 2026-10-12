import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '@/core/db/client';
import { companies, sequences, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { partners } from '@/modules/contacts/schema';
import { creditContracts, creditDebitItems, creditInstallments, creditPayments } from '../schema';
import {
  cancelBatch,
  closeBatch,
  contractDebitState,
  createBatch,
  exportBatch,
  getBatch,
  importResults,
  markRemainingPaid,
  saveMandate,
  settleItem,
} from '../service/debits';
import { recordPayment } from '../service/payments';

loadDevEnv();

const db = getDb();
const createdCompanies: string[] = [];

interface Fixture { args: TenantArgs; contractId: string }

function addMonths(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

/** Company, user, partner and an active contract whose installments fall in 2030 so the month is deterministic. */
async function activeContract(amounts: bigint[], opts: { state?: string } = {}): Promise<Fixture> {
  const companyId = randomUUID();
  const userId = randomUUID();
  const partnerId = randomUUID();
  const contractId = randomUUID();
  createdCompanies.push(companyId);

  await db.insert(companies).values({ id: companyId, legalName: 'Debit Test SARL', displayName: 'Debit Test' });
  await db.insert(users).values({ id: userId, name: 'debit test', email: `debit-${userId}@test.invalid` });
  await db.insert(partners).values({
    id: partnerId, companyId, kind: 'individual', isCustomer: true, displayName: 'Client Debit',
    firstName: 'Client', lastName: 'Debit', phone: '+213555000222',
  });
  const financed = amounts.reduce((a, b) => a + b, BigInt(0));
  const start = '2030-01-05';
  await db.insert(creditContracts).values({
    id: contractId, companyId, reference: `CR-DEBIT-${contractId.slice(0, 8)}`, partnerId,
    state: opts.state ?? 'active', startDate: start, frequency: 'monthly', installmentsCount: amounts.length,
    cashPriceCents: financed, markupRate: '0', markupCents: BigInt(0), totalCents: financed,
    downPaymentCents: BigInt(0), financedCents: financed,
  });
  await db.insert(creditInstallments).values(
    amounts.map((amountCents, i) => ({ companyId, contractId, seq: i + 1, dueDate: addMonths(start, i), amountCents })),
  );
  const args: TenantArgs = { userId, companyId, perms: new Set<string>(), locale: 'en' };
  return { args, contractId };
}

const run = <T>(f: Fixture, fn: Parameters<typeof withTenant<T>>[1]) => withTenant(f.args, fn, db);
const paidOf = async (contractId: string) =>
  (await db.select().from(creditInstallments).where(eq(creditInstallments.contractId, contractId)).orderBy(creditInstallments.seq)).map((r) => r.paidCents);

afterAll(async () => {
  if (createdCompanies.length) await db.delete(sequences).where(inArray(sequences.companyId, createdCompanies));
});

describe('CCP direct debit', { timeout: 60_000 }, () => {
  it('rejects a bad account number and needs a mandate before a contract is picked up', async () => {
    const f = await activeContract([BigInt(1000), BigInt(1000)]);
    const bad = await run(f, (ctx) => saveMandate(ctx, { contractId: f.contractId, ccpAccount: '12AB', signedOn: '2030-01-02' }));
    expect(bad.ok).toBe(false);

    const none = await run(f, (ctx) => createBatch(ctx, { month: '2030-01' }));
    expect(none.ok).toBe(false);

    const saved = await run(f, (ctx) => saveMandate(ctx, { contractId: f.contractId, ccpAccount: '0012 3456 78', signedOn: '2030-01-02' }));
    expect(saved.ok).toBe(true);
    const batch = await run(f, (ctx) => createBatch(ctx, { month: '2030-01' }));
    expect(batch.ok && batch.value.items).toBe(1);
  });

  it('collects installments due up to the end of the month, once, and exports a template file', async () => {
    const f = await activeContract([BigInt(1000), BigInt(1500), BigInt(2000)]);
    await run(f, (ctx) => saveMandate(ctx, { contractId: f.contractId, ccpAccount: '0012345678', signedOn: '2030-01-02' }));

    const first = await run(f, (ctx) => createBatch(ctx, { month: '2030-02' }));
    expect(first.ok && first.value.items).toBe(2);
    // The same installments cannot go into a second open batch.
    const second = await run(f, (ctx) => createBatch(ctx, { month: '2030-02' }));
    expect(second.ok).toBe(false);

    if (!first.ok) return;
    const file = await run(f, (ctx) => exportBatch(ctx, first.value.id));
    expect(file.ok).toBe(true);
    if (!file.ok) return;
    expect(file.value.csv.replace('﻿', '').split('\r\n')[0]).toBe('reference;contract;customer;ccp_account;amount_dzd;due_date');
    expect(file.value.csv).toContain('10,00');
    const after = await run(f, (ctx) => getBatch(ctx, first.value.id));
    expect(after?.batch.status).toBe('exported');
  });

  it('posts a paid debit as a ccp payment, once, on the settlement day', async () => {
    const f = await activeContract([BigInt(1000), BigInt(1000)]);
    await run(f, (ctx) => saveMandate(ctx, { contractId: f.contractId, ccpAccount: '0012345678', signedOn: '2030-01-02' }));
    const batch = await run(f, (ctx) => createBatch(ctx, { month: '2030-01' }));
    if (!batch.ok) throw new Error('batch');
    const data = await run(f, (ctx) => getBatch(ctx, batch.value.id));
    const item = data!.items[0]!;

    const paid = await run(f, (ctx) => settleItem(ctx, { itemId: item.id, outcome: 'paid', settledOn: '2030-01-07' }));
    expect(paid.ok && paid.value.outcome).toBe('paid');
    expect(await paidOf(f.contractId)).toEqual([BigInt(1000), BigInt(0)]);

    const payments = await db.select().from(creditPayments).where(eq(creditPayments.companyId, f.args.companyId));
    expect(payments).toHaveLength(1);
    expect(payments[0]?.method).toBe('ccp');
    expect(payments[0]?.externalRef).toBe(item.reference);
    expect(payments[0]?.receivedAt.toISOString().slice(0, 10)).toBe('2030-01-07');

    // A second result for the same item is refused, nothing is posted twice.
    const again = await run(f, (ctx) => settleItem(ctx, { itemId: item.id, outcome: 'paid', settledOn: '2030-01-07' }));
    expect(again.ok).toBe(false);
    expect(await db.select().from(creditPayments).where(eq(creditPayments.companyId, f.args.companyId))).toHaveLength(1);
  });

  it('keeps a debit that went through but cannot be posted as needs_review instead of dropping it', async () => {
    const f = await activeContract([BigInt(1000), BigInt(1000)]);
    await run(f, (ctx) => saveMandate(ctx, { contractId: f.contractId, ccpAccount: '0012345678', signedOn: '2030-01-02' }));
    const batch = await run(f, (ctx) => createBatch(ctx, { month: '2030-01' }));
    if (!batch.ok) throw new Error('batch');
    const item = (await run(f, (ctx) => getBatch(ctx, batch.value.id)))!.items[0]!;

    // The customer pays cash at the shop before the debit result arrives.
    const cash = await run(f, (ctx) => recordPayment(ctx, { contractId: f.contractId, amountCents: BigInt(1000), method: 'cash' }));
    expect(cash.ok).toBe(true);

    const result = await run(f, (ctx) => settleItem(ctx, { itemId: item.id, outcome: 'paid', settledOn: '2030-01-07' }));
    expect(result.ok && result.value.outcome).toBe('needs_review');
    const [row] = await db.select().from(creditDebitItems).where(eq(creditDebitItems.id, item.id));
    expect(row?.status).toBe('needs_review');
    expect(row?.reason).toBe('ALREADY_SETTLED_ELSEWHERE');
    expect(await paidOf(f.contractId)).toEqual([BigInt(1000), BigInt(0)]);

    const state = await run(f, (ctx) => contractDebitState(ctx, f.contractId));
    expect(state.open).toBe(1);
    // A batch with a debit still to review cannot be closed.
    const closed = await run(f, (ctx) => closeBatch(ctx, batch.value.id));
    expect(closed.ok).toBe(false);
  });

  it('records a rejection, frees the installment for the next batch and counts it on the contract', async () => {
    const f = await activeContract([BigInt(1000)]);
    await run(f, (ctx) => saveMandate(ctx, { contractId: f.contractId, ccpAccount: '0012345678', signedOn: '2030-01-02' }));
    const batch = await run(f, (ctx) => createBatch(ctx, { month: '2030-01' }));
    if (!batch.ok) throw new Error('batch');
    const item = (await run(f, (ctx) => getBatch(ctx, batch.value.id)))!.items[0]!;

    const r = await run(f, (ctx) => settleItem(ctx, { itemId: item.id, outcome: 'rejected', reason: 'insufficient funds', settledOn: '2030-01-07' }));
    expect(r.ok && r.value.outcome).toBe('rejected');
    const state = await run(f, (ctx) => contractDebitState(ctx, f.contractId));
    expect(state).toEqual({ open: 0, rejected: 1, lastRejectReason: 'insufficient funds' });

    const closed = await run(f, (ctx) => closeBatch(ctx, batch.value.id));
    expect(closed.ok).toBe(true);
    const next = await run(f, (ctx) => createBatch(ctx, { month: '2030-01' }));
    expect(next.ok && next.value.items).toBe(1);
  });

  it('imports a result file idempotently and reports unknown references', async () => {
    const f = await activeContract([BigInt(1000), BigInt(1000)]);
    await run(f, (ctx) => saveMandate(ctx, { contractId: f.contractId, ccpAccount: '0012345678', signedOn: '2030-01-02' }));
    const batch = await run(f, (ctx) => createBatch(ctx, { month: '2030-02' }));
    if (!batch.ok) throw new Error('batch');
    const items = (await run(f, (ctx) => getBatch(ctx, batch.value.id)))!.items;

    const text = `reference;status;reason;date\n${items[0]!.reference};paid;;2030-02-06\n${items[1]!.reference};rejected;closed account\nNOPE-1;paid`;
    const first = await run(f, (ctx) => importResults(ctx, { batchId: batch.value.id, text }));
    expect(first.ok && { paid: first.value.paid, rejected: first.value.rejected, unknown: first.value.unknown }).toEqual({ paid: 1, rejected: 1, unknown: ['NOPE-1'] });

    const second = await run(f, (ctx) => importResults(ctx, { batchId: batch.value.id, text }));
    expect(second.ok && { paid: second.value.paid, skipped: second.value.skipped }).toEqual({ paid: 0, skipped: 2 });
    expect(await db.select().from(creditPayments).where(eq(creditPayments.companyId, f.args.companyId))).toHaveLength(1);
  });

  it('marks the remaining items paid and cancels a batch only before anything is posted', async () => {
    const f = await activeContract([BigInt(1000), BigInt(1000)]);
    await run(f, (ctx) => saveMandate(ctx, { contractId: f.contractId, ccpAccount: '0012345678', signedOn: '2030-01-02' }));

    const a = await run(f, (ctx) => createBatch(ctx, { month: '2030-02' }));
    if (!a.ok) throw new Error('batch');
    const cancelled = await run(f, (ctx) => cancelBatch(ctx, a.value.id));
    expect(cancelled.ok).toBe(true);
    // Cancelling releases the installments.
    const b = await run(f, (ctx) => createBatch(ctx, { month: '2030-02' }));
    if (!b.ok) throw new Error('batch');

    const all = await run(f, (ctx) => markRemainingPaid(ctx, { batchId: b.value.id, settledOn: '2030-02-06' }));
    expect(all.ok && all.value).toEqual({ paid: 2, needsReview: 0 });
    expect(await paidOf(f.contractId)).toEqual([BigInt(1000), BigInt(1000)]);
    const refused = await run(f, (ctx) => cancelBatch(ctx, b.value.id));
    expect(refused.ok).toBe(false);
  });

  it('settles each debit on its own installment, whatever order the results arrive in', async () => {
    const f = await activeContract([BigInt(1000), BigInt(1000)]);
    await run(f, (ctx) => saveMandate(ctx, { contractId: f.contractId, ccpAccount: '0012345678', signedOn: '2030-01-02' }));
    const batch = await run(f, (ctx) => createBatch(ctx, { month: '2030-02' }));
    if (!batch.ok) throw new Error('batch');
    const [first, second] = (await run(f, (ctx) => getBatch(ctx, batch.value.id)))!.items;

    // The second installment's debit is entered first: it must pay the second installment, not fill the first.
    const r2 = await run(f, (ctx) => settleItem(ctx, { itemId: second!.id, outcome: 'paid', settledOn: '2030-02-06' }));
    expect(r2.ok && r2.value.outcome).toBe('paid');
    expect(await paidOf(f.contractId)).toEqual([BigInt(0), BigInt(1000)]);

    const r1 = await run(f, (ctx) => settleItem(ctx, { itemId: first!.id, outcome: 'paid', settledOn: '2030-02-06' }));
    expect(r1.ok && r1.value.outcome).toBe('paid');
    expect(await paidOf(f.contractId)).toEqual([BigInt(1000), BigInt(1000)]);
  });

  it('pays the right installment when an earlier one is still held in an unresolved debit', async () => {
    const f = await activeContract([BigInt(1000), BigInt(1000)]);
    await run(f, (ctx) => saveMandate(ctx, { contractId: f.contractId, ccpAccount: '0012345678', signedOn: '2030-01-02' }));

    // Batch A holds installment 1 (1000). The customer then pays 600 in the shop, so the debit can no longer be posted.
    const a = await run(f, (ctx) => createBatch(ctx, { month: '2030-01' }));
    if (!a.ok) throw new Error('batch A');
    const itemA = (await run(f, (ctx) => getBatch(ctx, a.value.id)))!.items[0]!;
    await run(f, (ctx) => recordPayment(ctx, { contractId: f.contractId, amountCents: BigInt(600), method: 'cash' }));
    const held = await run(f, (ctx) => settleItem(ctx, { itemId: itemA.id, outcome: 'paid', settledOn: '2030-01-07' }));
    expect(held.ok && held.value.outcome).toBe('needs_review');
    expect(await paidOf(f.contractId)).toEqual([BigInt(600), BigInt(0)]);

    // Batch B can only pick up installment 2, and its debit must settle installment 2, leaving installment 1 untouched.
    const b = await run(f, (ctx) => createBatch(ctx, { month: '2030-02' }));
    expect(b.ok && b.value.items).toBe(1);
    if (!b.ok) throw new Error('batch B');
    const itemB = (await run(f, (ctx) => getBatch(ctx, b.value.id)))!.items[0]!;
    const paid = await run(f, (ctx) => settleItem(ctx, { itemId: itemB.id, outcome: 'paid', settledOn: '2030-02-06' }));
    expect(paid.ok && paid.value.outcome).toBe('paid');
    expect(await paidOf(f.contractId)).toEqual([BigInt(600), BigInt(1000)]);
  });

  it('keeps a rejected installment open while the next one in the same batch is paid', async () => {
    const f = await activeContract([BigInt(1000), BigInt(1000)]);
    await run(f, (ctx) => saveMandate(ctx, { contractId: f.contractId, ccpAccount: '0012345678', signedOn: '2030-01-02' }));
    const batch = await run(f, (ctx) => createBatch(ctx, { month: '2030-02' }));
    if (!batch.ok) throw new Error('batch');
    const [first, second] = (await run(f, (ctx) => getBatch(ctx, batch.value.id)))!.items;

    const rej = await run(f, (ctx) => settleItem(ctx, { itemId: first!.id, outcome: 'rejected', reason: 'closed account', settledOn: '2030-02-06' }));
    expect(rej.ok && rej.value.outcome).toBe('rejected');
    const paid = await run(f, (ctx) => settleItem(ctx, { itemId: second!.id, outcome: 'paid', settledOn: '2030-02-06' }));
    expect(paid.ok && paid.value.outcome).toBe('paid');
    expect(await paidOf(f.contractId)).toEqual([BigInt(0), BigInt(1000)]);

    // The rejected installment is eligible again.
    const closed = await run(f, (ctx) => closeBatch(ctx, batch.value.id));
    expect(closed.ok).toBe(true);
    const next = await run(f, (ctx) => createBatch(ctx, { month: '2030-02' }));
    expect(next.ok && next.value.items).toBe(1);
  });

  it('is isolated per company', async () => {
    const a = await activeContract([BigInt(1000)]);
    const b = await activeContract([BigInt(1000)]);
    await run(a, (ctx) => saveMandate(ctx, { contractId: a.contractId, ccpAccount: '0012345678', signedOn: '2030-01-02' }));
    const batch = await run(a, (ctx) => createBatch(ctx, { month: '2030-01' }));
    if (!batch.ok) throw new Error('batch');
    expect(await run(b, (ctx) => getBatch(ctx, batch.value.id))).toBeNull();
  });
});
