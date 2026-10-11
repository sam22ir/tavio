import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { OWNER_PERMS } from '@/core/perms';
import { products, uoms } from '@/modules/products/schema';
import { partners } from '@/modules/contacts/schema';
import { deliveries, deliveryLines, stockMoves, stockReservations } from '@/modules/inventory/schema';
import { moveLines } from '@/modules/inventory/service/moves';
import { stockLevels } from '@/modules/inventory/service/stock';
import { ensureDefaultWarehouse } from '@/modules/inventory/service/warehouses';
import { setDeliverySignedBy, validateDelivery } from '@/modules/inventory/service/deliveries';
import { saleOrderLines, saleOrders } from '../schema';
import { cancelOrder, confirmOrder, createInvoiceFromOrder, createSaleOrder, getSaleOrder } from '../service/orders';

// Registers the cross-module handlers (order confirmation to delivery, delivery to order progress).
import '@/modules/inventory/events';
import '@/modules/sales/events';

loadDevEnv();

const db = getDb();
const createdCompanies: string[] = [];

async function fixture(): Promise<{ args: TenantArgs; goodsId: string; partnerId: string }> {
  const companyId = randomUUID();
  const userId = randomUUID();
  createdCompanies.push(companyId);
  await db.insert(companies).values({ id: companyId, legalName: 'Delivery Flow SARL', displayName: 'DeliveryFlow' });
  await db.insert(users).values({ id: userId, name: 'delivery flow', email: `dflow-${userId}@test.invalid` });
  const [unitRow] = await db.select({ id: uoms.id }).from(uoms).where(eq(uoms.code, 'unit')).limit(1);
  if (!unitRow) throw new Error('seeded uom "unit" missing: run scripts/seed-global.ts');
  const goodsId = randomUUID();
  await db.insert(products).values({
    id: goodsId,
    companyId,
    name: 'Washer',
    kind: 'goods',
    trackStock: true,
    invoicePolicy: 'delivery',
    uomId: unitRow.id,
    salePriceCents: BigInt(10000),
    costCents: BigInt(5000),
  });
  const partnerId = randomUUID();
  await db.insert(partners).values({
    id: partnerId,
    companyId,
    kind: 'company',
    isCustomer: true,
    displayName: 'Customer SARL',
    companyName: 'Customer SARL',
  });
  return { args: { userId, companyId, perms: OWNER_PERMS, locale: 'en' }, goodsId, partnerId };
}

afterAll(async () => {
  for (const id of createdCompanies) {
    await db.delete(stockMoves).where(eq(stockMoves.companyId, id));
    await db.delete(deliveryLines).where(eq(deliveryLines.companyId, id));
    await db.delete(deliveries).where(eq(deliveries.companyId, id));
    await db.delete(stockReservations).where(eq(stockReservations.companyId, id));
    await db.delete(saleOrderLines).where(eq(saleOrderLines.companyId, id));
    await db.delete(saleOrders).where(eq(saleOrders.companyId, id));
  }
});

describe.skipIf(!process.env.TAVIO_W5_DB)('sale order deliveries, backorders and invoicing (database)', () => {
  it('confirm, deliver 3 of 5, backorder 2, invoice 3, deliver 2, invoice 2, order done', async () => {
    const { args, goodsId, partnerId } = await fixture();

    await withTenant(args, async (ctx) => {
      const wh = await ensureDefaultWarehouse(ctx);
      const receipt = await moveLines(ctx, {
        lines: [{ productId: goodsId, quantity: '10' }],
        sourceEntity: 'test.receipt',
        sourceId: randomUUID(),
        reference: 'RC-FLOW',
        fromLocationId: wh.supplierLocationId,
        toLocationId: wh.internalLocationId,
        post: true,
      });
      expect(receipt.ok).toBe(true);
    });

    const orderId = await withTenant(args, async (ctx) => {
      const created = await createSaleOrder(ctx, {
        partnerId,
        orderDate: '2026-10-11',
        lines: [{ productId: goodsId, description: 'Washer', quantity: '5', unitPrice: '100', discount: '0', taxId: null }],
      });
      expect(created.ok).toBe(true);
      if (!created.ok) throw new Error(created.error.message);
      const confirmed = await confirmOrder(ctx, created.value.id);
      expect(confirmed.ok).toBe(true);
      return created.value.id;
    });

    const firstDelivery = await withTenant(args, async (ctx) => {
      const [row] = await ctx.tx
        .select({ id: deliveries.id, state: deliveries.state })
        .from(deliveries)
        .where(eq(deliveries.sourceId, orderId));
      expect(row?.state).toBe('draft');
      const lines = await ctx.tx.select({ id: deliveryLines.id }).from(deliveryLines).where(eq(deliveryLines.deliveryId, row?.id ?? ''));
      expect(lines.length).toBe(1);
      const signed = await setDeliverySignedBy(ctx, { deliveryId: row?.id ?? '', signedByName: 'Receiver' });
      expect(signed.ok).toBe(true);
      const validated = await validateDelivery(ctx, row?.id ?? '', {
        deliveredQty: { [lines[0]?.id ?? '']: '3' },
        noBackorder: false,
      });
      expect(validated.ok).toBe(true);
      if (!validated.ok) throw new Error(validated.error.message);
      expect(validated.value.backorderId).not.toBeNull();
      return row?.id ?? '';
    });

    await withTenant(args, async (ctx) => {
      const levels = await stockLevels(ctx);
      const row = levels.ok ? levels.value.find((r) => r.productId === goodsId) : undefined;
      expect(Number(row?.onHand ?? 0)).toBe(7);
      const progress = await getSaleOrder(ctx, orderId);
      expect(progress.ok && progress.value.progress.deliveryStatus).toBe('partial');
      expect(progress.ok && progress.value.deliveries.length).toBe(2);
      void firstDelivery;
    });

    await withTenant(args, async (ctx) => {
      const invoiced = await createInvoiceFromOrder(ctx, orderId);
      expect(invoiced.ok).toBe(true);
      const order = await getSaleOrder(ctx, orderId);
      if (!order.ok) throw new Error(order.error.message);
      expect(String(order.value.lines[0]?.invoicedQty)).toBe('3.000');
      expect(order.value.progress.done).toBe(false);
    });

    const backorder = await withTenant(args, async (ctx) => {
      const [row] = await ctx.tx
        .select({ id: deliveries.id })
        .from(deliveries)
        .where(eq(deliveries.originDeliveryId, firstDelivery));
      expect(row).toBeDefined();
      const signed = await setDeliverySignedBy(ctx, { deliveryId: row?.id ?? '', signedByName: 'Receiver' });
      expect(signed.ok).toBe(true);
      const validated = await validateDelivery(ctx, row?.id ?? '');
      expect(validated.ok).toBe(true);
      return row?.id ?? '';
    });
    expect(backorder).not.toBe('');

    await withTenant(args, async (ctx) => {
      const order = await getSaleOrder(ctx, orderId);
      if (!order.ok) throw new Error(order.error.message);
      expect(order.value.progress.deliveryStatus).toBe('delivered');
      expect(order.value.progress.done).toBe(false);
      const invoiced = await createInvoiceFromOrder(ctx, orderId);
      expect(invoiced.ok).toBe(true);
      const after = await getSaleOrder(ctx, orderId);
      if (!after.ok) throw new Error(after.error.message);
      expect(after.value.progress.done).toBe(true);
      expect(String(after.value.order.state)).toBe('done');
    });
  });

  it('refuses to cancel an order after a delivery', async () => {
    const { args, goodsId, partnerId } = await fixture();
    await withTenant(args, async (ctx) => {
      const wh = await ensureDefaultWarehouse(ctx);
      await moveLines(ctx, {
        lines: [{ productId: goodsId, quantity: '4' }],
        sourceEntity: 'test.receipt',
        sourceId: randomUUID(),
        reference: 'RC-CANCEL',
        fromLocationId: wh.supplierLocationId,
        toLocationId: wh.internalLocationId,
        post: true,
      });
    });
    const orderId = await withTenant(args, async (ctx) => {
      const created = await createSaleOrder(ctx, {
        partnerId,
        orderDate: '2026-10-11',
        lines: [{ productId: goodsId, description: 'Washer', quantity: '2', unitPrice: '100', discount: '0', taxId: null }],
      });
      if (!created.ok) throw new Error(created.error.message);
      const confirmed = await confirmOrder(ctx, created.value.id);
      if (!confirmed.ok) throw new Error(confirmed.error.message);
      return created.value.id;
    });
    await withTenant(args, async (ctx) => {
      const [row] = await ctx.tx.select({ id: deliveries.id }).from(deliveries).where(eq(deliveries.sourceId, orderId));
      await setDeliverySignedBy(ctx, { deliveryId: row?.id ?? '', signedByName: 'Receiver' });
      const validated = await validateDelivery(ctx, row?.id ?? '');
      expect(validated.ok).toBe(true);
    });
    await withTenant(args, async (ctx) => {
      const cancelled = await cancelOrder(ctx, orderId);
      expect(cancelled.ok).toBe(false);
      if (!cancelled.ok) expect(cancelled.error.message).toBe('ORDER_HAS_DELIVERIES_OR_INVOICES');
    });
  });
});
