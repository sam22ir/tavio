import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { ok } from '@/core/result';
import { partners } from '@/modules/contacts/schema';
import { activateContract, createDraftContract, type DraftContractInput } from '../service/contracts';
import { saveContractSettings } from '../service/clauses';
import { addGuarantor, listGuarantors, removeGuarantor, updateGuarantor } from '../service/guarantors';

// Chatter is a stub in this worktree; the integration test mocks it.
vi.mock('@/modules/chatter/service', () => ({
  postMessage: vi.fn(async () => ok({ id: 'msg' })),
}));

loadDevEnv();
vi.setConfig({ testTimeout: 30000 });

// Runs once the W15 tables are migrated: TAVIO_W5_DB=1 pnpm vitest run -c vitest.int.config.ts
describe.skipIf(!process.env.TAVIO_W5_DB)('credit guarantors and activation rule (database)', () => {
  const db = getDb();
  const userId = randomUUID();
  const companyA = randomUUID();
  const companyB = randomUUID();
  const partnerA = randomUUID();
  const PERMS = new Set([
    'credit_sales.contract.read',
    'credit_sales.contract.write',
    'credit_sales.contract.activate',
  ]);
  const argsFor = (companyId: string): TenantArgs => ({ userId, companyId, perms: PERMS, locale: 'en' });
  const draftInput: DraftContractInput = {
    partnerId: partnerA,
    lines: [{ description: 'Sofa', quantity: '1', unitPriceCents: BigInt(100000) }],
    downPaymentCents: BigInt(0),
    markupRate: '10',
    installmentsCount: 2,
    frequency: 'monthly',
    startDate: '2026-02-28',
  };
  const person = { fullName: 'Karim Saadi', nin: '123456789012345678', phone: '0550000000', address: 'Alger', relation: 'Frère' };

  beforeAll(async () => {
    await db.insert(users).values({ id: userId, name: 'guarantor test', email: `guarantor-${userId}@test.invalid` });
    await db.insert(companies).values([
      { id: companyA, legalName: 'Guarantor A', displayName: 'Guarantor A' },
      { id: companyB, legalName: 'Guarantor B', displayName: 'Guarantor B' },
    ]);
    await db.insert(partners).values({ id: partnerA, companyId: companyA, kind: 'individual', firstName: 'Test', lastName: 'Client', isCustomer: true, displayName: 'Client A', phone: null });
  });

  afterAll(async () => {
    // audit_log rows may block the company delete; cleanup is best effort.
    try {
      await db.delete(partners).where(inArray(partners.id, [partnerA]));
      await db.delete(companies).where(inArray(companies.id, [companyA, companyB]));
    } catch {
      // leave rows behind when the database refuses the delete
    }
  });

  it('adds, edits, lists and removes guarantors within the tenant', async () => {
    const created = await withTenant(argsFor(companyA), (ctx) => createDraftContract(ctx, draftInput));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const contractId = created.value.id;

    const added = await withTenant(argsFor(companyA), (ctx) => addGuarantor(ctx, contractId, person));
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    const listed = await withTenant(argsFor(companyA), (ctx) => listGuarantors(ctx, contractId));
    expect(listed.ok && listed.value.map((g) => g.fullName)).toEqual(['Karim Saadi']);

    const invisible = await withTenant(argsFor(companyB), (ctx) => listGuarantors(ctx, contractId));
    expect(invisible.ok && invisible.value.length).toBe(0);

    const updated = await withTenant(argsFor(companyA), (ctx) => updateGuarantor(ctx, added.value.id, { ...person, phone: '0660000000' }));
    expect(updated.ok).toBe(true);

    const removed = await withTenant(argsFor(companyA), (ctx) => removeGuarantor(ctx, added.value.id));
    expect(removed.ok).toBe(true);
    const after = await withTenant(argsFor(companyA), (ctx) => listGuarantors(ctx, contractId));
    expect(after.ok && after.value.length).toBe(0);
  });

  it('refuses activation above the threshold until a guarantor exists', async () => {
    const saved = await withTenant(argsFor(companyA), (ctx) => saveContractSettings(ctx, {
      clausesFr: null,
      clausesAr: null,
      city: 'Alger',
      latePenaltyRate: null,
      guarantorRequiredAboveCents: BigInt(50000),
    }));
    expect(saved.ok).toBe(true);

    const created = await withTenant(argsFor(companyA), (ctx) => createDraftContract(ctx, draftInput));
    if (!created.ok) throw new Error('draft not created');
    const contractId = created.value.id;

    const blocked = await withTenant(argsFor(companyA), (ctx) => activateContract(ctx, contractId));
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.message).toContain('guarantor is required');

    const added = await withTenant(argsFor(companyA), (ctx) => addGuarantor(ctx, contractId, person));
    expect(added.ok).toBe(true);

    const activated = await withTenant(argsFor(companyA), (ctx) => activateContract(ctx, contractId));
    expect(activated.ok).toBe(true);

    // Restore the default so other tests in this company are not affected.
    await withTenant(argsFor(companyA), (ctx) => saveContractSettings(ctx, {
      clausesFr: null, clausesAr: null, city: null, latePenaltyRate: null, guarantorRequiredAboveCents: null,
    }));
  });
});
