import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { deleteTestCompanies } from '@/testing/db-cleanup';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { createApiKey, authenticateApiKey } from '../service/api-keys';
import { createCustomFieldDef, listCustomFieldDefs } from '../service/custom-fields';
import { createWebhook } from '../service/webhooks';
import { handleOutboxRow } from '../outbox-handler';

// Needs the migrated DB tables (W5-K integration). Runs only when TAVIO_W5_DB is set.
loadDevEnv();

const db = getDb();
const userId = randomUUID();
const companyA = randomUUID();
const companyB = randomUUID();
const PERMS = new Set(['platform.custom_field.read', 'platform.custom_field.write', 'platform.api_key.read', 'platform.api_key.write', 'platform.webhook.write']);

const argsFor = (companyId: string, perms: ReadonlySet<string> = PERMS): TenantArgs => ({
  userId,
  companyId,
  perms,
  locale: 'en',
});

describe.skipIf(!process.env.TAVIO_W5_DB)('platform service (integration)', () => {
  beforeAll(async () => {
    await db.insert(users).values({ id: userId, email: `platform-${userId}@test.invalid`, name: 'Platform test' });
    await db.insert(companies).values([
      { id: companyA, legalName: 'Platform A', displayName: 'Platform A' },
      { id: companyB, legalName: 'Platform B', displayName: 'Platform B' },
    ]);
  });

  afterAll(async () => {
    await deleteTestCompanies(db, [companyA, companyB]);
    await db.delete(users).where(inArray(users.id, [userId]));
  });

  it('refuses custom field writes without permission', async () => {
    const result = await withTenant(argsFor(companyA, new Set()), (ctx) =>
      createCustomFieldDef(ctx, {
        entity: 'contacts.partner',
        key: 'segment',
        labelFr: 'Segment',
        labelAr: 'الشريحة',
        labelEn: 'Segment',
        fieldType: 'text',
        required: false,
        position: 0,
      }),
    );
    expect(result).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });

  it('isolates custom fields and api keys per company', async () => {
    await withTenant(argsFor(companyA), (ctx) =>
      createCustomFieldDef(ctx, {
        entity: 'contacts.partner',
        key: 'segment',
        labelFr: 'Segment',
        labelAr: 'الشريحة',
        labelEn: 'Segment',
        fieldType: 'text',
        required: false,
        position: 0,
      }),
    );
    const seenByB = await withTenant(argsFor(companyB), (ctx) => listCustomFieldDefs(ctx, 'contacts.partner'));
    expect(seenByB).toEqual({ ok: true, value: [] });

    const key = await withTenant(argsFor(companyA), (ctx) => createApiKey(ctx, { name: 'Test', scopes: ['contacts:read'] }));
    expect(key.ok).toBe(true);
    if (!key.ok) return;
    const auth = await authenticateApiKey(db, key.value.token);
    expect(auth).toMatchObject({ companyId: companyA, scopes: ['contacts:read'] });
    expect(await authenticateApiKey(db, `${key.value.token}x`)).toBeNull();
  });

  it('skips outbox events for companies without a matching webhook', async () => {
    const hook = await withTenant(argsFor(companyA), (ctx) =>
      createWebhook(ctx, { url: 'https://hooks.example.dz/tavio', events: ['pos.order.paid'] }),
    );
    expect(hook.ok).toBe(true);
    await expect(
      handleOutboxRow({ id: randomUUID(), companyId: companyB, eventName: 'pos.order.paid', payload: {}, attempts: 0 }, db),
    ).resolves.toBeUndefined();
  });
});
