import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { openSession, closeSession, sessionReport } from '../service/sessions';
import { createPaidOrder } from '../service/orders';

// Runs once the integrator has migrated the POS tables (TAVIO_W5_DB set).
loadDevEnv();

const db = getDb();
const userId = randomUUID();
const companyA = randomUUID();
const PERMS = new Set(['pos.session.read', 'pos.session.write', 'pos.order.read', 'pos.order.post']);

const argsFor = (): TenantArgs => ({ userId, companyId: companyA, perms: PERMS, locale: 'en' });

describe.skipIf(!process.env.TAVIO_W5_DB)('pos service (integration)', () => {
  beforeAll(async () => {
    await db.insert(users).values({ id: userId, name: 'POS test', email: `pos-${userId}@test.invalid` });
    await db.insert(companies).values({ id: companyA, legalName: 'POS A', displayName: 'POS A' });
  });

  afterAll(async () => {
    try {
      await db.delete(companies).where(eq(companies.id, companyA));
      await db.delete(users).where(eq(users.id, userId));
    } catch {
      // Audit rows reference the company, so cleanup can be refused. The rows keep random uuids.
    }
  });

  it('opens a session, then refuses a second open session for the company', async () => {
    const first = await withTenant(argsFor(), (ctx) => openSession(ctx, { openingCash: '5000' }));
    expect(first.ok).toBe(true);
    const second = await withTenant(argsFor(), (ctx) => openSession(ctx, { openingCash: '0' }));
    expect(second).toMatchObject({ ok: false, error: { code: 'STATE' } });
    // Close it so the later tests can open their own session for this company.
    if (first.ok) {
      await withTenant(argsFor(), (ctx) => closeSession(ctx, { sessionId: first.value.sessionId, closingCash: '5000' }));
    }
  });

  it('closes with expected cash = opening + cash sales and reports the difference', async () => {
    const opened = await withTenant(argsFor(), (ctx) => openSession(ctx, { openingCash: '1000' }));
    if (!opened.ok) throw new Error('open failed');
    const sessionId = opened.value.sessionId;

    const report = await withTenant(argsFor(), (ctx) =>
      closeSession(ctx, { sessionId, closingCash: '1000' }),
    );
    expect(report.ok).toBe(true);
    if (report.ok) {
      expect(report.value.expectedCashCents).toBe(BigInt(100000));
      expect(report.value.differenceCents).toBe(BigInt(0));
    }
  });

  it('refuses a sale on a closed session with STATE', async () => {
    const opened = await withTenant(argsFor(), (ctx) => openSession(ctx, { openingCash: '0' }));
    if (!opened.ok) throw new Error('open failed');
    const sessionId = opened.value.sessionId;
    await withTenant(argsFor(), (ctx) => closeSession(ctx, { sessionId, closingCash: '0' }));

    const sale = await withTenant(argsFor(), (ctx) =>
      createPaidOrder(ctx, { sessionId, method: 'cash', lines: [{ productId: randomUUID(), quantity: '1' }] }),
    );
    expect(sale).toMatchObject({ ok: false, error: { code: 'STATE' } });
  });

  it('report on an open session has no closing figures', async () => {
    const opened = await withTenant(argsFor(), (ctx) => openSession(ctx, { openingCash: '0' }));
    if (!opened.ok) throw new Error('open failed');
    const report = await withTenant(argsFor(), (ctx) => sessionReport(ctx, opened.value.sessionId));
    expect(report.ok && report.value.closingCashCents).toBeNull();
  });
});
