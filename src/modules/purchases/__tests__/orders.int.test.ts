import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { createPartner } from '@/modules/contacts/service/partners';
import { purchaseOrders } from '../schema';
import {
  cancelOrder,
  confirmOrder,
  createOrder,
  getOrder,
  receiveOrder,
  updateOrder,
  type OrderInput,
} from '../service/orders';

loadDevEnv();

// Needs the W5-D tables migrated (integrator). Skipped until TAVIO_W5_DB is set.
describe.skipIf(!process.env.TAVIO_W5_DB)('purchase orders (integration)', () => {
  const db = getDb();
  const userId = randomUUID();
  const companyId = randomUUID();
  const perms = new Set(['*']);
  const args: TenantArgs = { userId, companyId, perms, locale: 'en' };
  let partnerId = '';

  const orderInput = (): OrderInput => ({
    partnerId,
    expectedDate: null,
    note: null,
    lines: [
      { productId: null, description: 'Ciment', quantity: '2', unitPriceCents: BigInt(100000), taxId: null },
      { productId: null, description: 'Sable', quantity: '1.5', unitPriceCents: BigInt(20000), taxId: null },
    ],
  });

  afterAll(async () => {
    await db.delete(purchaseOrders).where(eq(purchaseOrders.companyId, companyId));
  });

  it('creates a draft with computed totals and no number', async () => {
    await db.insert(users).values({ id: userId, name: 'PO test', email: `po-${userId}@test.invalid` });
    await db.insert(companies).values({ id: companyId, legalName: 'PO test', displayName: 'PO test' });
    await withTenant(args, async (ctx) => {
      const partner = await createPartner(ctx, {
        kind: 'company',
        isCustomer: false,
        isSupplier: true,
        isProspect: false,
        firstName: undefined,
        lastName: undefined,
        companyName: 'Fournisseur test',
        nif: undefined,
        nis: undefined,
        rc: undefined,
        ai: undefined,
        phone: undefined,
        phoneAlt: undefined,
        email: undefined,
        address: undefined,
        wilayaCode: undefined,
        commune: undefined,
        employer: undefined,
        monthlyIncomeCents: undefined,
        notes: undefined,
      });
      expect(partner.ok).toBe(true);
      partnerId = partner.ok ? partner.value.id : '';
    }, db);

    const created = await withTenant(args, (ctx) => createOrder(ctx, orderInput()), db);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const detail = await withTenant(args, (ctx) => getOrder(ctx, created.value.id), db);
    expect(detail.ok && detail.value.order.number).toBeFalsy();
    expect(detail.ok && detail.value.order.totalCents).toBe(BigInt(220000));
  });

  it('confirms with a gap-free PO number and blocks edits afterwards', async () => {
    const created = await withTenant(args, (ctx) => createOrder(ctx, orderInput()), db);
    if (!created.ok) throw new Error('create failed');
    const id = created.value.id;
    const confirmed = await withTenant(args, (ctx) => confirmOrder(ctx, id), db);
    expect(confirmed.ok && confirmed.value.number.startsWith('PO-')).toBe(true);
    const edit = await withTenant(args, (ctx) => updateOrder(ctx, id, orderInput()), db);
    expect(!edit.ok && edit.error.code).toBe('POSTED_IMMUTABLE');
  });

  it('receives partially, then completes; cancel is refused after receipt', async () => {
    const created = await withTenant(args, (ctx) => createOrder(ctx, orderInput()), db);
    if (!created.ok) throw new Error('create failed');
    const id = created.value.id;
    await withTenant(args, (ctx) => confirmOrder(ctx, id), db);
    const detail = await withTenant(args, (ctx) => getOrder(ctx, id), db);
    if (!detail.ok) throw new Error('get failed');
    const cement = detail.value.lines.find((l) => l.description === 'Ciment');
    if (!cement) throw new Error('line missing');

    const partial = await withTenant(args, (ctx) => receiveOrder(ctx, id, [{ lineId: cement.id, quantity: '1' }]), db);
    expect(partial.ok && partial.value.state).toBe('confirmed');
    const cancel = await withTenant(args, (ctx) => cancelOrder(ctx, id), db);
    expect(!cancel.ok && cancel.error.code).toBe('CONFLICT');
    const rest = await withTenant(args, (ctx) => receiveOrder(ctx, id), db);
    expect(rest.ok && rest.value.state).toBe('received');
  });

  it('refuses confirm without the post permission', async () => {
    const created = await withTenant(args, (ctx) => createOrder(ctx, orderInput()), db);
    if (!created.ok) throw new Error('create failed');
    const denied = await withTenant(
      { ...args, perms: new Set(['purchases.order.read']) },
      (ctx) => confirmOrder(ctx, created.value.id),
      db,
    );
    expect(!denied.ok && denied.error.code).toBe('FORBIDDEN');
  });
});
