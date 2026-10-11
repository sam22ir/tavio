import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { getDb } from '@/core/db/client';
import { companies } from '@/core/db/schema/tenancy';
import { withTenant } from '@/core/db/tenant';
import { partners } from '@/modules/contacts/schema';
import { invoices } from '@/modules/invoicing/schema';
import { portalCtx } from '../context';
import { consumePortalToken } from '../consume';
import { partnerOwnsPostedInvoice } from '../queries';
import { issuePortalToken } from '../links';
import { generatePortalToken } from '../tokens';

loadDevEnv();

// Runs once the integrator has migrated the portal tables and RLS (TAVIO_W5_DB set).
describe.skipIf(!process.env.TAVIO_W5_DB)('customer portal isolation (database)', () => {
  const db = getDb();
  const staff = { userId: randomUUID(), perms: new Set(['*']) as ReadonlySet<string>, locale: 'fr' as const };
  let companyA = '';
  let companyB = '';
  let partnerA = '';
  let partnerA2 = '';
  let invoiceOfA = '';
  let invoiceOfA2 = '';
  let invoiceOfB = '';

  beforeAll(async () => {
    const [a] = await db.insert(companies).values({ legalName: 'Portal A', displayName: 'Portal A' }).returning({ id: companies.id });
    const [b] = await db.insert(companies).values({ legalName: 'Portal B', displayName: 'Portal B' }).returning({ id: companies.id });
    companyA = a!.id;
    companyB = b!.id;
    await withTenant({ ...staff, companyId: companyA }, async (ctx) => {
      const [p] = await ctx.tx.insert(partners).values({ companyId: companyA, kind: 'individual', displayName: 'A One', email: 'a1@example.dz', isCustomer: true }).returning({ id: partners.id });
      const [p2] = await ctx.tx.insert(partners).values({ companyId: companyA, kind: 'individual', displayName: 'A Two', isCustomer: true }).returning({ id: partners.id });
      partnerA = p!.id;
      partnerA2 = p2!.id;
      const [i] = await ctx.tx.insert(invoices).values({ companyId: companyA, type: 'out_invoice', number: 'FA-A1', partnerId: partnerA, state: 'posted', date: '2026-10-01' }).returning({ id: invoices.id });
      const [i2] = await ctx.tx.insert(invoices).values({ companyId: companyA, type: 'out_invoice', number: 'FA-A2', partnerId: partnerA2, state: 'posted', date: '2026-10-01' }).returning({ id: invoices.id });
      invoiceOfA = i!.id;
      invoiceOfA2 = i2!.id;
    });
    await withTenant({ ...staff, companyId: companyB }, async (ctx) => {
      const [p] = await ctx.tx.insert(partners).values({ companyId: companyB, kind: 'individual', displayName: 'B One', isCustomer: true }).returning({ id: partners.id });
      const [i] = await ctx.tx.insert(invoices).values({ companyId: companyB, type: 'out_invoice', number: 'FB-1', partnerId: p!.id, state: 'posted', date: '2026-10-01' }).returning({ id: invoices.id });
      invoiceOfB = i!.id;
    });
  });

  afterAll(async () => {
    await db.delete(companies).where(eq(companies.id, companyA));
    await db.delete(companies).where(eq(companies.id, companyB));
  });

  it("a token for partner A cannot read partner B's invoice, nor another partner's in the same company", async () => {
    await portalCtx({ companyId: companyA, partnerId: partnerA }, 'fr', async (scope) => {
      expect(await partnerOwnsPostedInvoice(scope, invoiceOfA)).toBe(true);
      expect(await partnerOwnsPostedInvoice(scope, invoiceOfA2)).toBe(false);
      expect(await partnerOwnsPostedInvoice(scope, invoiceOfB)).toBe(false);
    });
  });

  it('a session for company A sees nothing of company B, even with B invoice id and B partner id', async () => {
    const someB = await withTenant({ ...staff, companyId: companyB }, async (ctx) => ctx.tx.select({ id: partners.id }).from(partners).limit(1));
    await portalCtx({ companyId: companyA, partnerId: someB[0]!.id }, 'fr', async (scope) => {
      expect(await partnerOwnsPostedInvoice(scope, invoiceOfB)).toBe(false);
    });
  });

  it('refuses an expired login link', async () => {
    const issued = await withTenant({ ...staff, companyId: companyA }, (ctx) => issuePortalToken(ctx.tx, {
      companyId: companyA, partnerId: partnerA, purpose: 'login', createdBy: null,
      now: new Date(Date.now() - 2 * 60 * 60 * 1000),
    }));
    const result = await consumePortalToken(issued.token, 'fr');
    expect(result.ok).toBe(false);
  });

  it('accepts a login link once and refuses the second use', async () => {
    const issued = await withTenant({ ...staff, companyId: companyA }, (ctx) => issuePortalToken(ctx.tx, {
      companyId: companyA, partnerId: partnerA, purpose: 'login', createdBy: null,
    }));
    const first = await consumePortalToken(issued.token, 'fr');
    expect(first.ok).toBe(true);
    const second = await consumePortalToken(issued.token, 'fr');
    expect(second.ok).toBe(false);
  });

  it('refuses a token whose company prefix does not match its stored row', async () => {
    const issued = await withTenant({ ...staff, companyId: companyA }, (ctx) => issuePortalToken(ctx.tx, {
      companyId: companyA, partnerId: partnerA, purpose: 'document', createdBy: null,
    }));
    const forged = `${companyB}.${issued.token.split('.')[1]}`;
    const result = await consumePortalToken(forged, 'fr');
    expect(result.ok).toBe(false);
  });

  it('a token never grants a partner that is not in the token row', async () => {
    const token = generatePortalToken(companyA);
    expect((await consumePortalToken(token, 'fr')).ok).toBe(false);
  });
});
