// Idempotent repair for demo companies seeded before the event handlers were registered.
// Every step goes through the real services, which skip what already exists (by source and product).
import { and, eq, inArray, ne, or } from 'drizzle-orm';
import type { Ctx, Locale } from '@/core/ctx';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import type { Db } from '@/core/db/types';
import { companies } from '@/core/db/schema/tenancy';
import { activities } from '@/modules/chatter/schema';
import { installmentActivityTitle } from '@/modules/credit_sales/service/reminders';
import { ensureDefaultWarehouse } from '@/modules/inventory/service/warehouses';
import { moveLines, stockTrackedLines } from '@/modules/inventory/service/moves';
import { products } from '@/modules/products/schema';
import { purchaseOrderLines, purchaseOrders } from '@/modules/purchases/schema';
import { deliverDemoGoods } from './deliver-goods';
import { DEMO_PRODUCT_NAMES } from './sample-data';

export interface StockRepairReport {
  productsFixed: number;
  receiptOrders: number;
  deliveries: number;
  salesOrders: number;
  titlesRewritten: number;
}

const OLD_INSTALLMENT_TITLE = /^Installment (\d+) of (\S+) due (\d{4}-\d{2}-\d{2})$/;

function fail(step: string, message: string): never {
  throw new Error(`${step}: ${message}`);
}

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }, step: string): T {
  if (!result.ok) fail(step, result.error.message);
  return result.value;
}

async function repairInTx(ctx: Ctx, locale: Locale): Promise<StockRepairReport> {
  const report: StockRepairReport = { productsFixed: 0, receiptOrders: 0, deliveries: 0, salesOrders: 0, titlesRewritten: 0 };

  // 1. Physical demo products must be stock-tracked goods.
  const fixed = await ctx.tx
    .update(products)
    .set({ kind: 'goods', trackStock: true })
    .where(
      and(
        eq(products.companyId, ctx.companyId),
        inArray(products.name, [...DEMO_PRODUCT_NAMES]),
        or(ne(products.kind, 'goods'), eq(products.trackStock, false)),
      ),
    )
    .returning({ id: products.id });
  report.productsFixed = fixed.length;

  // 2. Receipts: received quantities of confirmed or received purchase orders.
  const wh = await ensureDefaultWarehouse(ctx);
  const orders = await ctx.tx
    .select({ id: purchaseOrders.id, number: purchaseOrders.number })
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.companyId, ctx.companyId), inArray(purchaseOrders.state, ['confirmed', 'received'])));
  for (const order of orders) {
    const rows = await ctx.tx
      .select({
        productId: purchaseOrderLines.productId,
        receivedQty: purchaseOrderLines.receivedQty,
        unitPriceCents: purchaseOrderLines.unitPriceCents,
      })
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.orderId, order.id));
    const received = rows
      .filter((r) => Number(r.receivedQty) > 0)
      .map((r) => ({ productId: r.productId, quantity: r.receivedQty, unitCostCents: r.unitPriceCents.toString() }));
    const lines = await stockTrackedLines(ctx, received);
    if (lines.length === 0) continue;
    const posted = unwrap(
      await moveLines(ctx, {
        lines,
        sourceEntity: 'purchases.order',
        sourceId: order.id,
        reference: order.number ?? '',
        fromLocationId: wh.supplierLocationId,
        toLocationId: wh.internalLocationId,
        post: true,
      }),
      'receipt moves',
    );
    if (posted.created > 0) report.receiptOrders += 1;
  }

  // 3-4. Credit contract deliveries and sales order moves (shared with the sample data seeder).
  const delivered = await deliverDemoGoods(ctx);
  report.deliveries = delivered.deliveries;
  report.salesOrders = delivered.salesOrders;

  // 5. Installment activity titles stored in English by the old daily job.
  const rows = await ctx.tx
    .select({ id: activities.id, summary: activities.summary })
    .from(activities)
    .where(and(eq(activities.companyId, ctx.companyId), eq(activities.entity, 'credit_sales.contract')));
  for (const row of rows) {
    const m = OLD_INSTALLMENT_TITLE.exec(row.summary);
    if (!m) continue;
    const summary = installmentActivityTitle(locale, { seq: m[1] ?? '', contractNumber: m[2] ?? '', dueDate: m[3] ?? '' });
    await ctx.tx.update(activities).set({ summary }).where(eq(activities.id, row.id));
    report.titlesRewritten += 1;
  }

  return report;
}

/** Repairs one company. Safe to run again: a second run creates nothing new. */
export async function repairDemoStock(tenant: TenantArgs, db: Db): Promise<StockRepairReport> {
  const [company] = await db.select({ locale: companies.defaultLocale }).from(companies).where(eq(companies.id, tenant.companyId));
  const locale = (company?.locale ?? 'fr') as Locale;
  return withTenant(tenant, (ctx) => repairInTx(ctx, locale), db);
}
