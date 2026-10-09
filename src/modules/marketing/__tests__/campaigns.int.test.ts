import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { partners } from '@/modules/contacts/schema';
import {
  buildRecipients,
  createCampaign,
  getCampaign,
  listRecipients,
  setRecipientStatus,
  updateCampaign,
  type CampaignValues,
} from '../service/campaigns';

loadDevEnv();

// Runs only once the integrator has migrated the marketing tables.
describe.skipIf(!process.env.TAVIO_W5_DB)('marketing campaigns (db)', () => {
  const db = getDb();
  const userId = randomUUID();
  const companyA = randomUUID();
  const companyB = randomUUID();
  const PERMS = new Set(['marketing.campaign.read', 'marketing.campaign.write', 'contacts.partner.read']);
  const argsFor = (companyId: string): TenantArgs => ({ userId, companyId, perms: PERMS, locale: 'fr' });
  const values: CampaignValues = {
    name: 'Test',
    channel: 'whatsapp',
    language: 'fr',
    messageFr: 'Bonjour {name} de {shop}',
    messageAr: 'مرحبا {name}',
    segment: { customer: true, prospect: false, hasOverdue: false },
  };
  let partnerId: string;

  beforeAll(async () => {
    await db.insert(users).values({ id: userId, name: 'Marketing test', email: `mkt-${userId}@test.invalid` });
    await db.insert(companies).values([
      { id: companyA, legalName: 'Mkt A', displayName: 'Shop A' },
      { id: companyB, legalName: 'Mkt B', displayName: 'Shop B' },
    ]);
    const [p] = await db
      .insert(partners)
      .values([
        { companyId: companyA, kind: 'individual', isCustomer: true, displayName: 'Amina Benali', firstName: 'Amina', lastName: 'Benali', phone: '+213555123456' },
        { companyId: companyA, kind: 'individual', isCustomer: true, displayName: 'No Phone', firstName: 'No', lastName: 'Phone' },
      ])
      .returning({ id: partners.id });
    partnerId = p!.id;
  });

  afterAll(async () => {
    await db.delete(companies).where(inArray(companies.id, [companyA, companyB]));
    await db.delete(users).where(inArray(users.id, [userId]));
  });

  it('builds recipients from the segment, skipping partners without a phone', async () => {
    const id = await withTenant(argsFor(companyA), async (ctx) => {
      const created = await createCampaign(ctx, values);
      if (!created.ok) throw new Error(created.error.code);
      return created.value.id;
    });
    const built = await withTenant(argsFor(companyA), (ctx) => buildRecipients(ctx, id, '2026-10-09'));
    expect(built).toEqual({ ok: true, value: { count: 1, skippedNoPhone: 1 } });

    const list = await withTenant(argsFor(companyA), (ctx) => listRecipients(ctx, id));
    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.value.rows[0]?.message).toBe('Bonjour Amina Benali de Shop A');
    }
  });

  it('marks the campaign sent once no recipient is pending, and then refuses edits', async () => {
    const id = await withTenant(argsFor(companyA), async (ctx) => {
      const created = await createCampaign(ctx, values);
      if (!created.ok) throw new Error(created.error.code);
      return created.value.id;
    });
    await withTenant(argsFor(companyA), (ctx) => buildRecipients(ctx, id, '2026-10-09'));
    const list = await withTenant(argsFor(companyA), (ctx) => listRecipients(ctx, id));
    const recipientId = list.ok ? list.value.rows[0]!.id : '';

    const marked = await withTenant(argsFor(companyA), (ctx) => setRecipientStatus(ctx, recipientId, 'sent'));
    expect(marked).toEqual({ ok: true, value: { campaignId: id, state: 'sent' } });

    const edit = await withTenant(argsFor(companyA), (ctx) => updateCampaign(ctx, id, values));
    expect(edit.ok).toBe(false);
    if (!edit.ok) expect(edit.error.code).toBe('POSTED_IMMUTABLE');
  });

  it('hides campaigns from another company', async () => {
    const id = await withTenant(argsFor(companyA), async (ctx) => {
      const created = await createCampaign(ctx, values);
      if (!created.ok) throw new Error(created.error.code);
      return created.value.id;
    });
    const other = await withTenant(argsFor(companyB), (ctx) => getCampaign(ctx, id));
    expect(other.ok).toBe(false);
    expect(partnerId).toBeTruthy();
  });
});
