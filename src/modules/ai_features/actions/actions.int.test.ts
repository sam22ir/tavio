import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { Ctx } from '@/core/ctx';
import { getDb } from '@/core/db/client';
import { aiActions, aiReminderLog, companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { loadDevEnv } from '@/core/env/load-dev-env';
import type { Result } from '@/core/result';
import { partners } from '@/modules/contacts/schema';
import { creditContracts, creditInstallments } from '@/modules/credit_sales/schema';
import { recordPayment } from '@/modules/credit_sales/service/payments';
import { invoices } from '@/modules/invoicing/schema';
import { confirm, propose, reject } from './service';
import { morningBriefing } from '../assistant/briefing';

loadDevEnv();

// The dev database is shared and live. Every row here sits under a brand-new random company and user.
// Rows created by the test are removed in afterAll where the tables allow it; audit_log stays (append-only).

const db = getDb();
const ASSIST = 'ai_features.assistant.use';
const READ = 'credit_sales.contract.read';
const INVOICE = 'invoicing.invoice.write';
const createdCompanies: string[] = [];

interface Fixture { companyId: string; userId: string; partnerId: string; contractId: string }

function addMonths(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

function args(f: { companyId: string; userId: string }, perms: string[]): TenantArgs {
  return { companyId: f.companyId, userId: f.userId, perms: new Set(perms), locale: 'en' };
}

function okValue<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r.value;
}

/** Company, user, customer and an active contract. Each installment amount is one month, starting on `startDate`. */
async function fixture(opts: { amounts: bigint[]; startDate: string }): Promise<Fixture> {
  const companyId = randomUUID();
  const userId = randomUUID();
  const partnerId = randomUUID();
  const contractId = randomUUID();
  createdCompanies.push(companyId);

  await db.insert(companies).values({ id: companyId, legalName: 'Test SARL', displayName: 'AI actions test' });
  await db.insert(users).values({ id: userId, name: 'ai actions test', email: `ai-act-${userId}@test.invalid` });
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
  const total = opts.amounts.reduce((a, b) => a + b, BigInt(0));
  await db.insert(creditContracts).values({
    id: contractId,
    companyId,
    reference: `CR-AI-${contractId.slice(0, 8)}`,
    partnerId,
    state: 'active',
    startDate: opts.startDate,
    frequency: 'monthly',
    installmentsCount: opts.amounts.length,
    cashPriceCents: total,
    markupRate: '0',
    markupCents: BigInt(0),
    totalCents: total,
    downPaymentCents: BigInt(0),
    financedCents: total,
  });
  await db.insert(creditInstallments).values(
    opts.amounts.map((amountCents, i) => ({
      companyId,
      contractId,
      seq: i + 1,
      dueDate: addMonths(opts.startDate, i),
      amountCents,
    })),
  );
  return { companyId, userId, partnerId, contractId };
}

/** A second user in an existing company, so a confirm from someone other than the proposer can be tested. */
async function otherUser(): Promise<string> {
  const userId = randomUUID();
  await db.insert(users).values({ id: userId, name: 'ai actions other', email: `ai-act-${userId}@test.invalid` });
  return userId;
}

async function actionRow(companyId: string, actionId: string) {
  const [row] = await db
    .select()
    .from(aiActions)
    .where(and(eq(aiActions.id, actionId), eq(aiActions.companyId, companyId)));
  if (!row) throw new Error('action row missing');
  return row;
}

async function reminderLogs(companyId: string, contractId: string) {
  return db
    .select()
    .from(aiReminderLog)
    .where(and(eq(aiReminderLog.companyId, companyId), eq(aiReminderLog.contractId, contractId)));
}

async function proposeReminder(f: Fixture) {
  return okValue(
    await withTenant(args(f, [ASSIST, READ]), (c) => propose(c, { kind: 'reminder_batch', contractIds: [f.contractId] }), db),
  );
}

afterAll(async () => {
  if (createdCompanies.length === 0) return;
  await db.delete(aiReminderLog).where(inArray(aiReminderLog.companyId, createdCompanies));
  await db.delete(aiActions).where(inArray(aiActions.companyId, createdCompanies));
});

describe('AI actions confirm path', { timeout: 120_000 }, () => {
  it('0. a new reminder proposal supersedes the open one for the same contract', async () => {
    const f = await fixture({ amounts: [BigInt(50000)], startDate: '2026-01-05' });
    const a = await proposeReminder(f);
    const b = await proposeReminder(f);

    expect((await actionRow(f.companyId, a.id)).state).toBe('rejected');
    expect((await actionRow(f.companyId, b.id)).state).toBe('proposed');
    const stale = await withTenant(args(f, [ASSIST, READ]), (c) => confirm(c, a.id), db);
    expect(stale.ok).toBe(false);
    expect((await reminderLogs(f.companyId, f.contractId)).length).toBe(0);
  });

  it('1. a second confirm writes nothing: one reminder log row and state stays confirmed', async () => {
    const f = await fixture({ amounts: [BigInt(50000)], startDate: '2026-01-05' });
    const p = await proposeReminder(f);

    const first = okValue(await withTenant(args(f, [ASSIST, READ]), (c) => confirm(c, p.id), db));
    expect(first.state).toBe('confirmed');
    expect(await reminderLogs(f.companyId, f.contractId)).toHaveLength(1);

    const second = await withTenant(args(f, [ASSIST, READ]), (c) => confirm(c, p.id), db);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('STATE');
    expect(await reminderLogs(f.companyId, f.contractId)).toHaveLength(1);
    expect((await actionRow(f.companyId, p.id)).state).toBe('confirmed');
  });

  it('2. a different user in the same company, or a user of another company, cannot confirm', async () => {
    const f = await fixture({ amounts: [BigInt(50000)], startDate: '2026-01-05' });
    const p = await proposeReminder(f);

    const sameCompanyUser = await otherUser();
    const sameCompany = await withTenant(
      { companyId: f.companyId, userId: sameCompanyUser, perms: new Set([ASSIST, READ]), locale: 'en' },
      (c) => confirm(c, p.id),
      db,
    );
    expect(sameCompany.ok).toBe(false);
    expect((await actionRow(f.companyId, p.id)).state).toBe('proposed');

    const outsider = await fixture({ amounts: [BigInt(1000)], startDate: '2030-01-05' });
    const otherCompany = await withTenant(args(outsider, [ASSIST, READ]), (c) => confirm(c, p.id), db);
    expect(otherCompany.ok).toBe(false);
    expect((await actionRow(f.companyId, p.id)).state).toBe('proposed');
    expect(await reminderLogs(f.companyId, f.contractId)).toHaveLength(0);
  });

  it('3. reject after confirm is a no-op, and confirm after reject does nothing', async () => {
    const f = await fixture({ amounts: [BigInt(50000)], startDate: '2026-01-05' });
    const confirmed = await proposeReminder(f);
    okValue(await withTenant(args(f, [ASSIST, READ]), (c) => confirm(c, confirmed.id), db));

    const lateReject = await withTenant(args(f, [ASSIST]), (c) => reject(c, confirmed.id), db);
    expect(lateReject.ok).toBe(false);
    expect((await actionRow(f.companyId, confirmed.id)).state).toBe('confirmed');

    const f2 = await fixture({ amounts: [BigInt(50000)], startDate: '2026-01-05' });
    const rejected = await proposeReminder(f2);
    okValue(await withTenant(args(f2, [ASSIST]), (c) => reject(c, rejected.id), db));
    const lateConfirm = await withTenant(args(f2, [ASSIST, READ]), (c) => confirm(c, rejected.id), db);
    expect(lateConfirm.ok).toBe(false);
    expect((await actionRow(f2.companyId, rejected.id)).state).toBe('rejected');
    expect(await reminderLogs(f2.companyId, f2.contractId)).toHaveLength(0);
  });

  it('4. when the late installment was paid in between, confirm fails and writes no reminder log', async () => {
    const f = await fixture({ amounts: [BigInt(50000)], startDate: '2026-01-05' });
    const p = await proposeReminder(f);

    okValue(
      await withTenant(
        args(f, []),
        (c) => recordPayment(c, { contractId: f.contractId, amountCents: BigInt(50000), method: 'cash' }),
        db,
      ),
    );

    const outcome = okValue(await withTenant(args(f, [ASSIST, READ]), (c) => confirm(c, p.id), db));
    expect(outcome.state).toBe('failed');
    expect(outcome.errorCode).toBe('CONFLICT');
    const row = await actionRow(f.companyId, p.id);
    expect(row.state).toBe('failed');
    expect(row.errorCode).toBe('CONFLICT');
    expect(await reminderLogs(f.companyId, f.contractId)).toHaveLength(0);
  });

  it('5. right after a polite reminder is prepared, the minimum gap leaves nothing to prepare', async () => {
    const f = await fixture({ amounts: [BigInt(50000), BigInt(50000)], startDate: '2026-01-05' });
    const p = await proposeReminder(f);
    okValue(await withTenant(args(f, [ASSIST, READ]), (c) => confirm(c, p.id), db));
    expect(await reminderLogs(f.companyId, f.contractId)).toHaveLength(1);

    const again = await withTenant(
      args(f, [ASSIST, READ]),
      (c) => propose(c, { kind: 'reminder_batch', contractIds: [f.contractId] }),
      db,
    );
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe('VALIDATION');
    const actions = await db.select().from(aiActions).where(eq(aiActions.companyId, f.companyId));
    expect(actions).toHaveLength(1);
    expect(await reminderLogs(f.companyId, f.contractId)).toHaveLength(1);
  });

  it('6. confirming a draft invoice creates exactly one draft, and a second confirm creates none', async () => {
    const f = await fixture({ amounts: [BigInt(1000)], startDate: '2030-01-05' });
    const p = okValue(
      await withTenant(
        args(f, [ASSIST, INVOICE]),
        (c) =>
          propose(c, {
            kind: 'draft_invoice',
            partnerId: f.partnerId,
            lines: [{ description: 'Riz 25 kg', quantity: '2', unitPriceCents: '250000' }],
          }),
        db,
      ),
    );

    const outcome = okValue(await withTenant(args(f, [ASSIST, INVOICE]), (c) => confirm(c, p.id), db));
    expect(outcome.state).toBe('confirmed');
    const invoiceId = outcome.result?.kind === 'draft_invoice' ? outcome.result.invoiceId : null;
    expect(invoiceId).toBeTruthy();

    const rows = await db.select().from(invoices).where(eq(invoices.partnerId, f.partnerId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(invoiceId);
    expect(rows[0]?.state).toBe('draft');
    expect(rows[0]?.type).toBe('out_invoice');

    const second = await withTenant(args(f, [ASSIST, INVOICE]), (c) => confirm(c, p.id), db);
    expect(second.ok).toBe(false);
    expect(await db.select().from(invoices).where(eq(invoices.partnerId, f.partnerId))).toHaveLength(1);
  });

  it('7. a user without credit_sales.contract.read cannot confirm a reminder batch', async () => {
    const f = await fixture({ amounts: [BigInt(50000)], startDate: '2026-01-05' });
    const p = await proposeReminder(f);

    const denied = await withTenant(args(f, [ASSIST]), (c: Ctx) => confirm(c, p.id), db);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe('FORBIDDEN');
    expect((await actionRow(f.companyId, p.id)).state).toBe('proposed');
    expect(await reminderLogs(f.companyId, f.contractId)).toHaveLength(0);
  });
});

describe('morning briefing', { timeout: 120_000 }, () => {
  it('proposes a reminder batch for a company with a late contract, without AI', async () => {
    const f = await fixture({ amounts: [BigInt(50000)], startDate: '2026-01-05' });
    const res = okValue(
      await withTenant(args(f, [ASSIST, READ]), (c) => morningBriefing(c, { ai: false }), db),
    );
    expect(res.answer).toBe('');
    expect(res.tables.map((t) => t.title)).toContain('Collections queue');
    expect(res.proposals).toHaveLength(1);
    const proposal = res.proposals[0];
    expect(proposal?.kind).toBe('reminder_batch');
    const row = await actionRow(f.companyId, proposal!.id);
    expect(row.state).toBe('proposed');
    expect(JSON.stringify(row.summary)).toContain(f.contractId);
  });

  it('for a role without credit read: no queue table, no proposal, and no error', async () => {
    const f = await fixture({ amounts: [BigInt(50000)], startDate: '2026-01-05' });
    const res = okValue(
      await withTenant(args(f, [ASSIST]), (c) => morningBriefing(c, { ai: false }), db),
    );
    expect(res.tables.map((t) => t.title)).not.toContain('Collections queue');
    expect(res.proposals).toEqual([]);
    expect(await reminderLogs(f.companyId, f.contractId)).toHaveLength(0);
  });
});
