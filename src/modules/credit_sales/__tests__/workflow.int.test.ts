import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { ok } from '@/core/result';
import { partners } from '@/modules/contacts/schema';
import { createDraftContract, getContract, type DraftContractInput } from '../service/contracts';
import { listContractDocuments, listDocumentRequirements, saveDocumentRequirement } from '../service/documents';
import { decideContract, startReview, submitContract } from '../service/workflow';

// Chatter is a stub in this worktree; the integration test mocks it.
vi.mock('@/modules/chatter/service', () => ({
  postMessage: vi.fn(async () => ok({ id: 'msg' })),
}));

loadDevEnv();
vi.setConfig({ testTimeout: 30000 });

const db = getDb();
const userId = randomUUID();
const companyA = randomUUID();
const companyB = randomUUID();
const partnerA = randomUUID();
const partnerB = randomUUID();
const PERMS = new Set([
  'credit_sales.contract.read',
  'credit_sales.contract.write',
  'credit_sales.contract.activate',
  'credit_sales.contract.cancel',
]);
const argsFor = (companyId: string): TenantArgs => ({ userId, companyId, perms: PERMS, locale: 'en' });
const reqName = `CIN ${randomUUID().slice(0, 8)}`;

function draftInput(partnerId: string): DraftContractInput {
  return {
    partnerId,
    lines: [{ description: 'Fridge', quantity: '1', unitPriceCents: BigInt(100000) }],
    downPaymentCents: BigInt(0),
    markupRate: '10',
    installmentsCount: 2,
    frequency: 'monthly',
    startDate: '2026-02-28',
  };
}

beforeAll(async () => {
  await db.insert(users).values({ id: userId, name: 'workflow test', email: `workflow-${userId}@test.invalid` });
  await db.insert(companies).values([
    { id: companyA, legalName: 'Workflow A', displayName: 'Workflow A' },
    { id: companyB, legalName: 'Workflow B', displayName: 'Workflow B' },
  ]);
  await db.insert(partners).values([
    { id: partnerA, companyId: companyA, kind: 'individual', firstName: 'Test', lastName: 'Client', isCustomer: true, displayName: 'Client A', phone: null },
    { id: partnerB, companyId: companyB, kind: 'individual', firstName: 'Other', lastName: 'Tenant', isCustomer: true, displayName: 'Client B', phone: null },
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

describe('credit workflow: requirements and documents', () => {
  it('keeps document requirements and contract documents within the tenant', async () => {
    const saved = await withTenant(argsFor(companyA), (ctx) => saveDocumentRequirement(ctx, { name: reqName, required: true, active: true }));
    expect(saved.ok).toBe(true);

    const visibleToB = await withTenant(argsFor(companyB), (ctx) => listDocumentRequirements(ctx));
    expect(visibleToB.ok).toBe(true);
    if (visibleToB.ok) expect(visibleToB.value.map((r) => r.name)).not.toContain(reqName);

    const created = await withTenant(argsFor(companyA), (ctx) => createDraftContract(ctx, draftInput(partnerA)));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const contractId = created.value.id;

    const submitted = await withTenant(argsFor(companyA), (ctx) => submitContract(ctx, contractId));
    expect(submitted.ok).toBe(true);

    const docsA = await withTenant(argsFor(companyA), (ctx) => listContractDocuments(ctx, contractId));
    expect(docsA.ok && docsA.value.map((d) => d.name)).toContain(reqName);

    const docsB = await withTenant(argsFor(companyB), (ctx) => listContractDocuments(ctx, contractId));
    expect(docsB.ok && docsB.value).toEqual([]);

    const foreign = await withTenant(argsFor(companyB), (ctx) => getContract(ctx, contractId));
    expect(foreign.ok).toBe(false);
  });

  it('blocks review while a required document is missing, and refusal needs a reason', async () => {
    const created = await withTenant(argsFor(companyA), (ctx) => createDraftContract(ctx, draftInput(partnerA)));
    if (!created.ok) throw new Error('setup failed');
    const id = created.value.id;
    await withTenant(argsFor(companyA), (ctx) => submitContract(ctx, id));

    const review = await withTenant(argsFor(companyA), (ctx) => startReview(ctx, id));
    expect(review.ok).toBe(false);

    const noReason = await withTenant(argsFor(companyA), (ctx) => decideContract(ctx, id, { decision: 'refused' }));
    expect(noReason.ok).toBe(false);
  });
});
