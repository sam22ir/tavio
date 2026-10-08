import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '@/core/db/client';
import { companies, sequences, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { partners } from '@/modules/contacts/schema';
import {
  creditContracts,
  creditInstallments,
  creditPaymentAllocations,
  creditPayments,
  creditReceipts,
} from '../schema';
import { listDueSoon, listOverdue, listPayments, recordPayment } from '../service/payments';

loadDevEnv();

const db = getDb();
const createdCompanies: string[] = [];

interface Fixture { args: TenantArgs; contractId: string; partnerId: string }

function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

function addMonths(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

function todayAlgiers(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(new Date());
}

/** Inserts company, user, partner and an active contract with installments via the owner connection. */
async function activeContract(opts: {
  amounts: bigint[];
  startDate?: string;
  downPaymentCents?: bigint;
}): Promise<Fixture> {
  const companyId = randomUUID();
  const userId = randomUUID();
  const partnerId = randomUUID();
  const contractId = randomUUID();
  createdCompanies.push(companyId);

  await db.insert(companies).values({ id: companyId, legalName: 'Test SARL', displayName: 'Test' });
  await db.insert(users).values({ id: userId, name: 'payments test', email: `pay-${userId}@test.invalid` });
  await db.insert(partners).values({
    id: partnerId,
    companyId,
    kind: 'individual',
    isCustomer: true,
    displayName: 'Client Test',
    firstName: 'Client',
    lastName: 'Test',
    phone: '+213555000111',
  });

  const financed = opts.amounts.reduce((a, b) => a + b, BigInt(0));
  const down = opts.downPaymentCents ?? BigInt(0);
  const start = opts.startDate ?? '2030-01-05';
  await db.insert(creditContracts).values({
    id: contractId,
    companyId,
    reference: `CR-TEST-${contractId.slice(0, 8)}`,
    partnerId,
    state: 'active',
    startDate: start,
    frequency: 'monthly',
    installmentsCount: opts.amounts.length,
    cashPriceCents: financed + down,
    markupRate: '0',
    markupCents: BigInt(0),
    totalCents: financed + down,
    downPaymentCents: down,
    financedCents: financed,
  });
  await db.insert(creditInstallments).values(
    opts.amounts.map((amountCents, i) => ({
      companyId,
      contractId,
      seq: i + 1,
      dueDate: addMonths(start, i),
      amountCents,
    })),
  );

  const args: TenantArgs = { userId, companyId, perms: new Set<string>(), locale: 'en' };
  return { args, contractId, partnerId };
}

async function installments(contractId: string) {
  return db
    .select()
    .from(creditInstallments)
    .where(eq(creditInstallments.contractId, contractId))
    .orderBy(creditInstallments.seq);
}

afterAll(async () => {
  if (createdCompanies.length) {
    await db.delete(sequences).where(inArray(sequences.companyId, createdCompanies));
  }
});

describe('recordPayment', { timeout: 60_000 }, () => {
  it('spreads a partial payment over installments oldest first', async () => {
    const f = await activeContract({ amounts: [BigInt(1000), BigInt(1000), BigInt(1000)] });

    const first = await withTenant(
      f.args,
      (ctx) => recordPayment(ctx, { contractId: f.contractId, amountCents: BigInt(1500), method: 'cash' }),
      db,
    );
    expect(first.ok).toBe(true);
    let rows = await installments(f.contractId);
    expect(rows.map((r) => r.paidCents)).toEqual([BigInt(1000), BigInt(500), BigInt(0)]);

    const second = await withTenant(
      f.args,
      (ctx) => recordPayment(ctx, { contractId: f.contractId, amountCents: BigInt(700), method: 'ccp' }),
      db,
    );
    expect(second.ok).toBe(true);
    rows = await installments(f.contractId);
    expect(rows.map((r) => r.paidCents)).toEqual([BigInt(1000), BigInt(1000), BigInt(200)]);

    const allocs = await db
      .select()
      .from(creditPaymentAllocations)
      .where(eq(creditPaymentAllocations.companyId, f.args.companyId));
    expect(allocs.reduce((s, a) => s + a.amountCents, BigInt(0))).toBe(BigInt(2200));
  });

  it('issues receipt numbers with no gaps', async () => {
    const f = await activeContract({ amounts: [BigInt(1000), BigInt(1000), BigInt(1000)] });
    const seqs: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await withTenant(
        f.args,
        (ctx) => recordPayment(ctx, { contractId: f.contractId, amountCents: BigInt(500), method: 'cash' }),
        db,
      );
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.receiptNumber).toMatch(/^RC-\d{4}-\d{5}$/);
        seqs.push(Number(r.value.receiptNumber.slice(-5)));
      }
    }
    expect(seqs[1]).toBe(seqs[0]! + 1);
    expect(seqs[2]).toBe(seqs[1]! + 1);
  });

  it('rejects an overpayment and records nothing', async () => {
    const f = await activeContract({ amounts: [BigInt(1000)] });
    const r = await withTenant(
      f.args,
      (ctx) => recordPayment(ctx, { contractId: f.contractId, amountCents: BigInt(1001), method: 'cash' }),
      db,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ code: 'VALIDATION', message: 'OVERPAYMENT' });
    const payments = await db.select().from(creditPayments).where(eq(creditPayments.partnerId, f.partnerId));
    expect(payments).toHaveLength(0);
  });

  it('completes the contract when everything is paid', async () => {
    const f = await activeContract({ amounts: [BigInt(1000), BigInt(500)] });
    const r = await withTenant(
      f.args,
      (ctx) => recordPayment(ctx, { contractId: f.contractId, amountCents: BigInt(1500), method: 'transfer' }),
      db,
    );
    expect(r.ok).toBe(true);
    const [contract] = await db.select().from(creditContracts).where(eq(creditContracts.id, f.contractId));
    expect(contract?.state).toBe('completed');
    expect(contract?.completedAt).not.toBeNull();
    const receipts = await db.select().from(creditReceipts).where(eq(creditReceipts.partnerId, f.partnerId));
    expect(receipts).toHaveLength(1);
    expect(receipts[0]?.totalCents).toBe(BigInt(1500));
  });

  it('allows a down payment only once and leaves installments untouched', async () => {
    const f = await activeContract({ amounts: [BigInt(1000)], downPaymentCents: BigInt(300) });
    const first = await withTenant(
      f.args,
      (ctx) =>
        recordPayment(ctx, { contractId: f.contractId, amountCents: BigInt(300), method: 'cash', isDownPayment: true }),
      db,
    );
    expect(first.ok).toBe(true);
    const rows = await installments(f.contractId);
    expect(rows[0]?.paidCents).toBe(BigInt(0));

    const second = await withTenant(
      f.args,
      (ctx) =>
        recordPayment(ctx, { contractId: f.contractId, amountCents: BigInt(100), method: 'cash', isDownPayment: true }),
      db,
    );
    expect(second.ok).toBe(false);
  });
});

describe('overdue and due-soon', () => {
  it('detects overdue installments from a backdated start date', async () => {
    const today = todayAlgiers();
    const tenDaysAgo = addDays(today, -10);
    const f = await activeContract({ amounts: [BigInt(1000), BigInt(1000)], startDate: tenDaysAgo });

    const overdue = await withTenant(f.args, (ctx) => listOverdue(ctx, { partnerId: f.partnerId }), db);
    expect(overdue).toHaveLength(1);
    expect(overdue[0]).toMatchObject({ seq: 1, dueDate: tenDaysAgo, daysLate: 10, dueCents: BigInt(1000) });

    const soon = await withTenant(f.args, (ctx) => listDueSoon(ctx, 7), db);
    expect(soon.filter((r) => r.contractId === f.contractId)).toHaveLength(0);
  });

  it('lists installments due within the window as due soon', async () => {
    const f = await activeContract({ amounts: [BigInt(1000)], startDate: todayAlgiers() });
    const soon = await withTenant(f.args, (ctx) => listDueSoon(ctx, 7), db);
    expect(soon.filter((r) => r.contractId === f.contractId)).toHaveLength(1);
  });
});

describe('listPayments', () => {
  it('lists payments with receipt and contract references', async () => {
    const f = await activeContract({ amounts: [BigInt(1000)] });
    await withTenant(
      f.args,
      (ctx) => recordPayment(ctx, { contractId: f.contractId, amountCents: BigInt(400), method: 'cash' }),
      db,
    );
    const res = await withTenant(f.args, (ctx) => listPayments(ctx, { page: 1, pageSize: 25, filters: {} }), db);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]).toMatchObject({ partnerName: 'Client Test', amountCents: '400', method: 'cash' });
    expect(String(res.rows[0]?.receiptNumber)).toMatch(/^RC-/);
    expect(res.rows[0]?.contractNumber).toMatch(/^CR-TEST-/);
  });
});
