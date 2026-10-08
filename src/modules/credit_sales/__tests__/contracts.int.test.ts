import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { ok } from '@/core/result';
import { partners } from '@/modules/contacts/schema';
import { creditInstallments } from '../schema';
import {
  activateContract,
  cancelContract,
  createDraftContract,
  getContract,
  listContracts,
  updateDraftContract,
  type DraftContractInput,
} from '../service/contracts';

// Chatter is a stub in this worktree; the integration test mocks it.
vi.mock('@/modules/chatter/service', () => ({
  postMessage: vi.fn(async () => ok({ id: 'msg' })),
}));

loadDevEnv();
// Each test runs several transactions against a remote database.
vi.setConfig({ testTimeout: 30000 });

const db = getDb();
const userId = randomUUID();
const companyA = randomUUID();
const companyB = randomUUID();
const PERMS = new Set([
  'credit_sales.contract.read',
  'credit_sales.contract.write',
  'credit_sales.contract.activate',
  'credit_sales.contract.cancel',
]);
const argsFor = (companyId: string): TenantArgs => ({ userId, companyId, perms: PERMS, locale: 'en' });
const partnerA = randomUUID();
const partnerB = randomUUID();
const PARTNER_NAME = `Client ${randomUUID().slice(0, 8)}`;

// 2 x 1000 DA + 1.5 x 500 DA = 2750 DA cash; down 500 DA; markup 20% of 2250 DA = 450 DA;
// total 3200 DA; financed 2700 DA; 3 monthly installments of 900 DA.
function draftInput(partnerId: string, overrides: Partial<DraftContractInput> = {}): DraftContractInput {
  return {
    partnerId,
    lines: [
      { description: 'Fridge', quantity: '2', unitPriceCents: BigInt(100000) },
      { description: 'Washer', quantity: '1.5', unitPriceCents: BigInt(50000) },
    ],
    downPaymentCents: BigInt(50000),
    markupRate: '20',
    installmentsCount: 3,
    frequency: 'monthly',
    startDate: '2026-01-31',
    ...overrides,
  };
}

beforeAll(async () => {
  await db.insert(users).values({ id: userId, name: 'contracts test', email: `contracts-${userId}@test.invalid` });
  await db.insert(companies).values([
    { id: companyA, legalName: 'Contracts A', displayName: 'Contracts A' },
    { id: companyB, legalName: 'Contracts B', displayName: 'Contracts B' },
  ]);
  await db.insert(partners).values([
    { id: partnerA, companyId: companyA, kind: 'individual', firstName: 'Test', lastName: 'Client', isCustomer: true, displayName: PARTNER_NAME, phone: '0550000001' },
    { id: partnerB, companyId: companyB, kind: 'individual', firstName: 'Other', lastName: 'Tenant', isCustomer: true, displayName: 'Other tenant', phone: null },
  ]);
});

afterAll(async () => {
  // audit_log rows may block the company delete; cleanup is best effort.
  try {
    await db.delete(partners).where(inArray(partners.id, [partnerA, partnerB]));
    await db.delete(companies).where(inArray(companies.id, [companyA, companyB]));
  } catch {
    // leave rows behind when the database refuses the delete
  }
});

describe('contracts: draft to activation', () => {
  it('creates a draft, computes money, activates with a number and an installment plan', async () => {
    const a = argsFor(companyA);
    const created = await withTenant(a, (ctx) => createDraftContract(ctx, draftInput(partnerA)));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = created.value.id;

    const detail = await withTenant(a, (ctx) => getContract(ctx, id));
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.value.contract.state).toBe('draft');
    expect(detail.value.contract.cashPriceCents).toBe(BigInt(275000));
    expect(detail.value.contract.markupCents).toBe(BigInt(45000));
    expect(detail.value.contract.totalCents).toBe(BigInt(320000));
    expect(detail.value.contract.financedCents).toBe(BigInt(270000));
    expect(detail.value.lines.map((l) => l.lineTotalCents)).toEqual([BigInt(200000), BigInt(75000)]);
    expect(detail.value.installments).toHaveLength(0);

    const activated = await withTenant(a, (ctx) => activateContract(ctx, id));
    expect(activated.ok).toBe(true);
    if (!activated.ok) return;
    expect(activated.value.number).toMatch(/^CR-\d{4}-00001$/);

    const active = await withTenant(a, (ctx) => getContract(ctx, id));
    expect(active.ok).toBe(true);
    if (!active.ok) return;
    expect(active.value.contract.state).toBe('active');
    expect(active.value.contract.reference).toBe(activated.value.number);
    expect(active.value.installments.map((i) => i.dueDate)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    const sum = active.value.installments.reduce((acc, i) => acc + i.amountCents, BigInt(0));
    expect(sum).toBe(active.value.contract.financedCents);
    expect(active.value.totals.remainingCents).toBe(BigInt(270000));

    const again = await withTenant(a, (ctx) => activateContract(ctx, id));
    expect(again.ok).toBe(false);
    const edit = await withTenant(a, (ctx) => updateDraftContract(ctx, id, draftInput(partnerA)));
    expect(edit.ok).toBe(false);
  });

  it('updates a draft and replaces its lines', async () => {
    const a = argsFor(companyA);
    const created = await withTenant(a, (ctx) => createDraftContract(ctx, draftInput(partnerA)));
    if (!created.ok) throw new Error('create failed');
    const id = created.value.id;
    const updated = await withTenant(a, (ctx) =>
      updateDraftContract(ctx, id, draftInput(partnerA, {
        lines: [{ description: 'Oven', quantity: '1', unitPriceCents: BigInt(120000) }],
        downPaymentCents: BigInt(0),
      })),
    );
    expect(updated.ok).toBe(true);
    const detail = await withTenant(a, (ctx) => getContract(ctx, id));
    if (!detail.ok) throw new Error('get failed');
    expect(detail.value.lines).toHaveLength(1);
    expect(detail.value.contract.cashPriceCents).toBe(BigInt(120000));
  });

  it('rejects a down payment above the cash price and an unknown partner', async () => {
    const a = argsFor(companyA);
    const tooMuchDown = await withTenant(a, (ctx) =>
      createDraftContract(ctx, draftInput(partnerA, { downPaymentCents: BigInt(99999999) })),
    );
    expect(tooMuchDown.ok).toBe(false);
    const missing = await withTenant(a, (ctx) => createDraftContract(ctx, draftInput(randomUUID())));
    expect(missing.ok).toBe(false);
  });
});

describe('contracts: cancellation rules', () => {
  it('cancels an active contract without payments', async () => {
    const a = argsFor(companyA);
    const created = await withTenant(a, (ctx) => createDraftContract(ctx, draftInput(partnerA)));
    if (!created.ok) throw new Error('create failed');
    const activated = await withTenant(a, (ctx) => activateContract(ctx, created.value.id));
    if (!activated.ok) throw new Error('activate failed');
    const cancelled = await withTenant(a, (ctx) => cancelContract(ctx, created.value.id, 'Client moved away'));
    expect(cancelled.ok).toBe(true);
    const detail = await withTenant(a, (ctx) => getContract(ctx, created.value.id));
    if (!detail.ok) throw new Error('get failed');
    expect(detail.value.contract.state).toBe('cancelled');
    expect(detail.value.contract.cancelledAt).not.toBeNull();
  });

  it('refuses to cancel a contract with payments unless the reason starts with force:', async () => {
    const a = argsFor(companyA);
    const created = await withTenant(a, (ctx) => createDraftContract(ctx, draftInput(partnerA)));
    if (!created.ok) throw new Error('create failed');
    const id = created.value.id;
    await withTenant(a, (ctx) => activateContract(ctx, id));
    // Simulate an allocation through the owner connection: first installment paid.
    const [first] = await db
      .select({ id: creditInstallments.id })
      .from(creditInstallments)
      .where(eq(creditInstallments.contractId, id))
      .orderBy(creditInstallments.seq)
      .limit(1);
    if (!first) throw new Error('no installment');
    await db.update(creditInstallments).set({ paidCents: BigInt(30000) }).where(eq(creditInstallments.id, first.id));

    const blocked = await withTenant(a, (ctx) => cancelContract(ctx, id, 'Changed mind'));
    expect(blocked.ok).toBe(false);
    const forced = await withTenant(a, (ctx) => cancelContract(ctx, id, 'force: client deceased'));
    expect(forced.ok).toBe(true);
  });
});

describe('contracts: isolation and listing', () => {
  it('hides company A contracts from company B', async () => {
    const created = await withTenant(argsFor(companyA), (ctx) => createDraftContract(ctx, draftInput(partnerA)));
    if (!created.ok) throw new Error('create failed');
    const foreign = await withTenant(argsFor(companyB), (ctx) => getContract(ctx, created.value.id));
    expect(foreign.ok).toBe(false);
    const list = await withTenant(argsFor(companyB), (ctx) =>
      listContracts(ctx, { page: 1, pageSize: 25, filters: {} }),
    );
    expect(list.total).toBe(0);
  });

  it('searches by partner name and filters by state', async () => {
    const a = argsFor(companyA);
    const bySearch = await withTenant(a, (ctx) =>
      listContracts(ctx, { q: PARTNER_NAME.slice(0, 10), page: 1, pageSize: 25, filters: {} }),
    );
    expect(bySearch.total).toBeGreaterThan(0);
    expect(bySearch.rows.every((r) => r.partnerName === PARTNER_NAME)).toBe(true);

    const cancelledOnly = await withTenant(a, (ctx) =>
      listContracts(ctx, { page: 1, pageSize: 100, filters: { state: 'cancelled' } }),
    );
    expect(cancelledOnly.rows.every((r) => r.state === 'cancelled')).toBe(true);
  });
});
