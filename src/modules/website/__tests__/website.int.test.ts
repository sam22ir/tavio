import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { webOrders, websiteSettings } from '../schema';
import { saveSettings, getSettings, settingsInput } from '../service/settings';
import { getWebOrder, listWebOrders, transitionWebOrder } from '../service/orders';
import { placeWebOrder, resolveShop } from '../service/public';
import { parseListQuery } from '@/core/entities/list-query';
import { webOrderEntity } from '../entities';

loadDevEnv();

// Runs only once the W5 tables are migrated: TAVIO_W5_DB=1 pnpm vitest run -c vitest.int.config.ts
describe.skipIf(!process.env.TAVIO_W5_DB)('website (integration)', () => {
  const db = getDb();
  const userId = randomUUID();
  const companyA = randomUUID();
  const companyB = randomUUID();
  const PERMS = new Set([
    'website.settings.read',
    'website.settings.write',
    'website.order.read',
    'website.order.write',
  ]);
  const slugA = `shop-${randomUUID().slice(0, 8)}`;

  const argsFor = (companyId: string, perms: ReadonlySet<string> = PERMS): TenantArgs => ({
    userId,
    companyId,
    perms,
    locale: 'en',
  });

  beforeAll(async () => {
    await db.insert(users).values({ id: userId, name: 'Website test', email: `website-${userId}@test.invalid` });
    await db.insert(companies).values([
      { id: companyA, legalName: 'Website A', displayName: 'Website A' },
      { id: companyB, legalName: 'Website B', displayName: 'Website B' },
    ]);
  });

  afterAll(async () => {
    try {
      await db.delete(webOrders).where(inArray(webOrders.companyId, [companyA, companyB]));
      await db.delete(websiteSettings).where(inArray(websiteSettings.companyId, [companyA, companyB]));
      await db.delete(companies).where(inArray(companies.id, [companyA, companyB]));
    } catch {
      // Rows left behind are harmless; the ids are random.
    }
  });

  const baseSettings = (slug: string) =>
    settingsInput.parse({ slug, enabled: 'on', title: 'Boutique', about: '', phoneWhatsapp: '0661 00 00 01', showPrices: 'on' });

  it('saves settings and refuses a slug owned by another company', async () => {
    const a = await withTenant(argsFor(companyA), (ctx) => saveSettings(ctx, baseSettings(slugA)));
    expect(a.ok).toBe(true);
    const taken = await withTenant(argsFor(companyB), (ctx) => saveSettings(ctx, baseSettings(slugA)));
    expect(taken.ok).toBe(false);
    if (!taken.ok) expect(taken.error.code).toBe('CONFLICT');
  });

  it('returns FORBIDDEN without the settings permission', async () => {
    const r = await withTenant(argsFor(companyA, new Set(['website.order.read'])), (ctx) => getSettings(ctx));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('FORBIDDEN');
  });

  it('confirms a new web order once and refuses a second transition', async () => {
    const [row] = await db
      .insert(webOrders)
      .values({
        companyId: companyA,
        number: `WEB-TEST-${randomUUID().slice(0, 8)}`,
        customerName: 'Test Client',
        phone: '+213661000001',
        wilayaCode: '16',
        address: 'Rue test 1',
        lines: [],
        totalCents: BigInt(0),
        state: 'new',
      })
      .returning({ id: webOrders.id });
    if (!row) throw new Error('insert failed');

    const first = await withTenant(argsFor(companyA), (ctx) => transitionWebOrder(ctx, row.id, 'confirm'));
    expect(first.ok && first.value.state).toBe('confirmed');
    const second = await withTenant(argsFor(companyA), (ctx) => transitionWebOrder(ctx, row.id, 'cancel'));
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('STATE');
  });

  it('hides another company web orders from list and get', async () => {
    const [row] = await db
      .select({ id: webOrders.id })
      .from(webOrders)
      .where(eq(webOrders.companyId, companyA))
      .limit(1);
    if (!row) return;
    const got = await withTenant(argsFor(companyB), (ctx) => getWebOrder(ctx, row.id));
    expect(got.ok).toBe(false);
    const list = await withTenant(argsFor(companyB), (ctx) =>
      listWebOrders(ctx, parseListQuery({}, webOrderEntity)),
    );
    expect(list.ok && list.value.rows.every((r) => r.id !== row.id)).toBe(true);
  });

  it('resolves only enabled shops and rate-limits checkout per phone', async () => {
    const shop = await resolveShop(slugA, db);
    expect(shop?.companyId).toBe(companyA);
    expect(await resolveShop(`${slugA}-missing`, db)).toBeNull();

    // Five orders in the last hour are already on file for this phone; the sixth is refused.
    const phone = '+213555000111';
    await db.insert(webOrders).values(
      Array.from({ length: 5 }, (_, i) => ({
        companyId: companyA,
        number: `WEB-RL-${randomUUID().slice(0, 8)}-${i}`,
        customerName: 'Rate Limit',
        phone,
        wilayaCode: '16',
        address: 'Rue test 2',
        lines: [],
        totalCents: BigInt(0),
        state: 'new',
      })),
    );
    const refused = await placeWebOrder(
      {
        slug: slugA,
        customerName: 'Rate Limit',
        phone: '0555 00 01 11',
        wilayaCode: '16',
        address: 'Rue test 2',
        lines: [{ productId: randomUUID(), quantity: 1 }],
      },
      db,
    );
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.details?.reason).toBe('RATE_LIMITED');
  });
});
