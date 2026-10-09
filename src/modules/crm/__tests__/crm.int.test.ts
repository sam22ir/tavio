import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import type { ListQuery } from '@/core/entities/types';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { err, ok } from '@/core/result';
import { createDraftContract } from '@/modules/credit_sales/service/contracts';
import { creditContracts } from '@/modules/credit_sales/schema';
import {
  convertToContract,
  createLead,
  createLostReason,
  ensureDefaultPipeline,
  getLead,
  leadsByStage,
  listLeads,
  logAttempt,
  listLostReasons,
  listStages,
  markLost,
  moveLead,
  reopenLead,
  setLeadVisibilityRestriction,
  updateLead,
} from '../service';

loadDevEnv();

// Chatter and credit sales are other modules' stubs in this worktree. Their behaviour is mocked here.
vi.mock('@/modules/chatter/service', () => ({
  postMessage: vi.fn(async () => ({ ok: true, value: { id: '00000000-0000-4000-8000-000000000001' } })),
}));
vi.mock('@/modules/credit_sales/service/contracts', () => ({
  createDraftContract: vi.fn(),
}));

const userId = randomUUID();
const companyId = randomUUID();
const otherCompanyId = randomUUID();
const PERMS = new Set(['crm.lead.read', 'crm.lead.write']);
const args = (cid = companyId): TenantArgs => ({ userId, companyId: cid, perms: PERMS, locale: 'en' });
const query = (over: Partial<ListQuery> = {}): ListQuery => ({ page: 1, pageSize: 25, filters: {}, ...over });

beforeAll(async () => {
  const db = getDb();
  await db.insert(users).values({ id: userId, name: 'CRM Test', email: `crm-${userId}@test.invalid` });
  await db.insert(companies).values([
    { id: companyId, legalName: 'CRM Test A', displayName: 'CRM A' },
    { id: otherCompanyId, legalName: 'CRM Test B', displayName: 'CRM B' },
  ]);
});

// The default mock writes a real draft row, because leads.converted_contract_id has a foreign key.
beforeEach(() => {
  vi.mocked(createDraftContract).mockReset();
  vi.mocked(createDraftContract).mockImplementation(async (ctx, input) => {
    const [row] = await ctx.tx
      .insert(creditContracts)
      .values({
        companyId: ctx.companyId,
        reference: `CTR-TEST-${randomUUID()}`,
        partnerId: input.partnerId,
        startDate: input.startDate,
        frequency: input.frequency,
        installmentsCount: input.installmentsCount,
        cashPriceCents: BigInt(0),
        markupCents: BigInt(0),
        totalCents: BigInt(0),
        downPaymentCents: input.downPaymentCents,
        financedCents: BigInt(0),
      })
      .returning({ id: creditContracts.id });
    return ok({ id: row?.id ?? '' });
  });
});

describe('pipeline seeding', () => {
  it('creates the default pipeline once, with the four default stages', async () => {
    const a = args(randomUUID());
    await getDb().insert(companies).values({ id: a.companyId, legalName: 'Pipeline test', displayName: 'Pipeline' });
    const first = await withTenant(a, (ctx) => ensureDefaultPipeline(ctx));
    const second = await withTenant(a, (ctx) => ensureDefaultPipeline(ctx));
    expect(first.ok && first.value.created).toBe(true);
    expect(second.ok && second.value.created).toBe(false);
    if (!first.ok || !second.ok) throw new Error('seeding failed');
    expect(first.value.id).toBe(second.value.id);

    const stages = await withTenant(a, (ctx) => listStages(ctx, first.value.id));
    expect(stages.ok && stages.value.map((s) => s.probability)).toEqual([10, 30, 60, 100]);
    expect(stages.ok && stages.value.find((s) => s.isWon)?.name).toBe('Won');
  });
});

describe('leads', { timeout: 30000 }, () => {
  it('creates, searches, moves to won, and groups by stage', async () => {
    const a = args();
    const created = await withTenant(a, (ctx) =>
      createLead(ctx, { name: 'Achat frigo, Oran', contactName: 'Yacine Bouzid', phone: '0550000001' }),
    );
    if (!created.ok) throw new Error(created.error.message);
    expect(created.value.reference).toMatch(/^LEAD-\d{4}-\d{5}$/);

    const found = await withTenant(a, (ctx) => listLeads(ctx, query({ q: 'bouzid' })));
    expect(found.ok && found.value.rows.map((r) => r.id)).toContain(created.value.id);

    const byStage = await withTenant(a, async (ctx) => {
      const p = await ensureDefaultPipeline(ctx);
      if (!p.ok) throw new Error(p.error.message);
      return leadsByStage(ctx, p.value.id);
    });
    expect(byStage.ok && byStage.value[0]?.leads.some((l) => l.id === created.value.id)).toBe(true);

    const won = await withTenant(a, async (ctx) => {
      const stages = await ensureDefaultPipeline(ctx).then((p) => (p.ok ? listStages(ctx, p.value.id) : null));
      const wonStage = stages?.ok ? stages.value.find((s) => s.isWon) : undefined;
      if (!wonStage) throw new Error('no won stage');
      return moveLead(ctx, created.value.id, wonStage.id);
    });
    expect(won.ok).toBe(true);
    const row = await withTenant(a, (ctx) => getLead(ctx, created.value.id));
    expect(row.ok && row.value.status).toBe('won');
    expect(row.ok && row.value.wonAt).toBeTruthy();
  });

  it('updates fields but leaves the stage alone', async () => {
    const a = args();
    const created = await withTenant(a, (ctx) => createLead(ctx, { name: 'Update me' }));
    if (!created.ok) throw new Error(created.error.message);
    const updated = await withTenant(a, (ctx) => updateLead(ctx, created.value.id, { name: 'Updated', probability: 45 }));
    expect(updated.ok).toBe(true);
    const row = await withTenant(a, (ctx) => getLead(ctx, created.value.id));
    expect(row.ok && [row.value.name, row.value.probability]).toEqual(['Updated', 45]);
  });

  it('marks lost with a reason, reopens, and refuses a missing reason', async () => {
    const a = args();
    const reason = await withTenant(a, (ctx) => createLostReason(ctx, { name: `Too expensive ${randomUUID()}` }));
    if (!reason.ok) throw new Error(reason.error.message);
    const reasons = await withTenant(a, (ctx) => listLostReasons(ctx));
    expect(reasons.ok && reasons.value.some((r) => r.id === reason.value.id)).toBe(true);

    const created = await withTenant(a, (ctx) => createLead(ctx, { name: 'Lose me' }));
    if (!created.ok) throw new Error(created.error.message);
    const noReason = await withTenant(a, (ctx) => markLost(ctx, created.value.id));
    expect(noReason.ok ? 'ok' : noReason.error.code).toBe('VALIDATION');

    const lost = await withTenant(a, (ctx) => markLost(ctx, created.value.id, reason.value.id, 'Called back in May'));
    expect(lost.ok).toBe(true);
    const lostRow = await withTenant(a, (ctx) => getLead(ctx, created.value.id));
    expect(lostRow.ok && lostRow.value.status).toBe('lost');

    const reopened = await withTenant(a, (ctx) => reopenLead(ctx, created.value.id));
    expect(reopened.ok).toBe(true);
    const openRow = await withTenant(a, (ctx) => getLead(ctx, created.value.id));
    expect(openRow.ok && openRow.value.status).toBe('open');
  });

  it('converts to a draft contract, creating the partner, and refuses a second conversion', async () => {
    const a = args();
    const created = await withTenant(a, (ctx) =>
      createLead(ctx, { name: 'Convert me', contactName: 'Amel Haddad', phone: '0660000002' }),
    );
    if (!created.ok) throw new Error(created.error.message);
    const draftId = randomUUID();
    vi.mocked(createDraftContract).mockImplementationOnce(async (ctx, input) => {
      const [row] = await ctx.tx
        .insert(creditContracts)
        .values({ companyId: ctx.companyId, reference: `CTR-TEST-${draftId}`, partnerId: input.partnerId, startDate: input.startDate, frequency: input.frequency, installmentsCount: input.installmentsCount, cashPriceCents: BigInt(0), markupCents: BigInt(0), totalCents: BigInt(0), downPaymentCents: input.downPaymentCents, financedCents: BigInt(0), id: draftId })
        .returning({ id: creditContracts.id });
      return ok({ id: row?.id ?? '' });
    });

    const converted = await withTenant(a, (ctx) =>
      convertToContract(ctx, created.value.id, {
        lines: [],
        downPaymentCents: BigInt(0),
        markupRate: '20',
        installmentsCount: 6,
        frequency: 'monthly',
        startDate: '2026-11-01',
      }),
    );
    if (!converted.ok) throw new Error(converted.error.message);
    expect(converted.value.contractId).toBe(draftId);
    expect(vi.mocked(createDraftContract).mock.calls[0]?.[1].partnerId).toBe(converted.value.partnerId);
    expect(vi.mocked(createDraftContract).mock.calls[0]?.[1].leadId).toBe(created.value.id);

    const row = await withTenant(a, (ctx) => getLead(ctx, created.value.id));
    expect(row.ok && [row.value.status, row.value.partnerId]).toEqual(['won', converted.value.partnerId]);

    const again = await withTenant(a, (ctx) =>
      convertToContract(ctx, created.value.id, {
        lines: [],
        downPaymentCents: BigInt(0),
        markupRate: '20',
        installmentsCount: 6,
        frequency: 'monthly',
        startDate: '2026-11-01',
      }),
    );
    expect(again.ok ? 'ok' : again.error.code).toBe('CONFLICT');
  });

  it('rolls back the partner when the draft contract fails', async () => {
    const a = args();
    const created = await withTenant(a, (ctx) => createLead(ctx, { name: 'Rollback lead', contactName: 'Nadia Rollback' }));
    if (!created.ok) throw new Error(created.error.message);
    vi.mocked(createDraftContract).mockResolvedValueOnce(err('FORBIDDEN', 'no contract rights'));

    const result = await withTenant(a, (ctx) =>
      convertToContract(ctx, created.value.id, {
        lines: [],
        downPaymentCents: BigInt(0),
        markupRate: '20',
        installmentsCount: 6,
        frequency: 'monthly',
        startDate: '2026-11-01',
      }),
    );
    expect(result.ok ? 'ok' : result.error.code).toBe('FORBIDDEN');
    const row = await withTenant(a, (ctx) => getLead(ctx, created.value.id));
    expect(row.ok && row.value.partnerId).toBeNull();
    expect(row.ok && row.value.convertedContractId).toBeNull();
  });

  it('isolates companies: another company cannot see the lead', async () => {
    const a = args();
    const created = await withTenant(a, (ctx) => createLead(ctx, { name: 'Private lead' }));
    if (!created.ok) throw new Error(created.error.message);
    const other = await withTenant(args(otherCompanyId), (ctx) => getLead(ctx, created.value.id));
    expect(other.ok ? 'ok' : other.error.code).toBe('NOT_FOUND');
  });
});


describe('lead visibility setting', () => {
  // The writer owns one lead; the reader is a different user with read-only, and a second user with read and write but no view permission.
  const writerArgs = args();
  const readerId = randomUUID();
  const readOnly: TenantArgs = { userId: readerId, companyId, perms: new Set(['crm.lead.read']), locale: 'en' };
  const readWriteOwn: TenantArgs = { userId: readerId, companyId, perms: new Set(['crm.lead.read', 'crm.lead.write']), locale: 'en' };
  let writerLead: string;
  let ownLead: string;

  beforeAll(async () => {
    const w = await withTenant(writerArgs, (ctx) => createLead(ctx, { name: 'Writer lead', salespersonId: userId }));
    if (!w.ok) throw new Error(w.error.message);
    writerLead = w.value.id;
    const o = await withTenant(writerArgs, (ctx) => createLead(ctx, { name: 'Reader lead', salespersonId: readerId }));
    if (!o.ok) throw new Error(o.error.message);
    ownLead = o.value.id;
  });

  afterAll(async () => {
    await withTenant(writerArgs, (ctx) => setLeadVisibilityRestriction(ctx, false));
  });

  it('is off by default: a read-only user sees every lead', async () => {
    const list = await withTenant(readOnly, (ctx) => listLeads(ctx, query()));
    expect(list.ok && list.value.rows.map((r) => r.id)).toEqual(expect.arrayContaining([writerLead, ownLead]));
    const one = await withTenant(readOnly, (ctx) => getLead(ctx, writerLead));
    expect(one.ok).toBe(true);
  });

  it('when on, a read-only user sees only their own leads', async () => {
    const on = await withTenant(writerArgs, (ctx) => setLeadVisibilityRestriction(ctx, true));
    expect(on.ok).toBe(true);

    const list = await withTenant(readOnly, (ctx) => listLeads(ctx, query()));
    const ids = list.ok ? list.value.rows.map((r) => r.id) : [];
    expect(ids).toContain(ownLead);
    expect(ids).not.toContain(writerLead);

    const other = await withTenant(readOnly, (ctx) => getLead(ctx, writerLead));
    expect(other.ok ? 'ok' : other.error.code).toBe('NOT_FOUND');
  });

  it('when on, writes outside the scope are NOT_FOUND', async () => {
    const updated = await withTenant(readWriteOwn, (ctx) => updateLead(ctx, writerLead, { name: 'Hijacked' }));
    expect(updated.ok ? 'ok' : updated.error.code).toBe('NOT_FOUND');
    const logged = await withTenant(readWriteOwn, (ctx) => logAttempt(ctx, writerLead));
    expect(logged.ok ? 'ok' : logged.error.code).toBe('NOT_FOUND');

    const own = await withTenant(readWriteOwn, (ctx) => updateLead(ctx, ownLead, { name: 'Mine' }));
    expect(own.ok).toBe(true);
  });
});
