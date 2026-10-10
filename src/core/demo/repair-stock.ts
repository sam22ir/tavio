// Idempotent repair for demo companies seeded before the event handlers were registered.
// Every step goes through the real services, which skip what already exists (by source and product).
import { and, eq, inArray, ne, or } from 'drizzle-orm';
import type { Ctx, Locale } from '@/core/ctx';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import type { Db } from '@/core/db/types';
import { companies } from '@/core/db/schema/tenancy';
import { activities } from '@/modules/chatter/schema';
import { partners } from '@/modules/contacts/schema';
import { creditContracts, creditContractLines } from '@/modules/credit_sales/schema';
import { installmentActivityTitle } from '@/modules/credit_sales/service/reminders';
import { deliveries, stockMoves } from '@/modules/inventory/schema';
import { ensureDefaultWarehouse } from '@/modules/inventory/service/warehouses';
import { moveLines, stockTrackedLines, validateMove } from '@/modules/inventory/service/moves';
import { createDraftDelivery, setDeliverySignedBy, validateDelivery } from '@/modules/inventory/service/deliveries';
import { products } from '@/modules/products/schema';
import { purchaseOrderLines, purchaseOrders } from '@/modules/purchases/schema';
import { saleOrderLines, saleOrders } from '@/modules/sales/schema';
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

  // 3. Credit contracts that were handed over: draft delivery, signed by the customer, then validated.
  const contracts = await ctx.tx
    .select({ id: creditContracts.id, partnerId: creditContracts.partnerId })
    .from(creditContracts)
    .where(and(eq(creditContracts.companyId, ctx.companyId), inArray(creditContracts.state, ['active', 'completed'])));
  for (const contract of contracts) {
    const lines = await ctx.tx
      .select({ productId: creditContractLines.productId, quantity: creditContractLines.quantity })
      .from(creditContractLines)
      .where(eq(creditContractLines.contractId, contract.id));
    const tracked = await stockTrackedLines(ctx, lines);
    if (tracked.length === 0) continue;
    unwrap(
      await createDraftDelivery(ctx, {
        partnerId: contract.partnerId,
        sourceEntity: 'credit_sales.contract',
        sourceId: contract.id,
        lines: tracked,
      }),
      'contract delivery',
    );
    const [partner] = await ctx.tx.select({ name: partners.displayName }).from(partners).where(eq(partners.id, contract.partnerId));
    const open = await ctx.tx
      .select({ id: deliveries.id, signedByName: deliveries.signedByName })
      .from(deliveries)
      .where(
        and(
          eq(deliveries.companyId, ctx.companyId),
          eq(deliveries.sourceEntity, 'credit_sales.contract'),
          eq(deliveries.sourceId, contract.id),
          inArray(deliveries.state, ['draft', 'ready']),
        ),
      );
    for (const delivery of open) {
      if (!delivery.signedByName && partner) {
        unwrap(await setDeliverySignedBy(ctx, { deliveryId: delivery.id, signedByName: partner.name }), 'delivery signer');
      }
      unwrap(await validateDelivery(ctx, delivery.id), 'validate delivery');
      report.deliveries += 1;
    }
  }

  // 4. Sales orders: outgoing moves for stock-tracked lines, validated (the seeded orders are past-dated).
  const sales = await ctx.tx
    .select({ id: saleOrders.id, number: saleOrders.number })
    .from(saleOrders)
    .where(and(eq(saleOrders.companyId, ctx.companyId), inArray(saleOrders.state, ['confirmed', 'done', 'invoiced'])));
  for (const sale of sales) {
    const lines = await ctx.tx
      .select({ productId: saleOrderLines.productId, quantity: saleOrderLines.quantity })
      .from(saleOrderLines)
      .where(eq(saleOrderLines.orderId, sale.id));
    const tracked = await stockTrackedLines(ctx, lines);
    if (tracked.length === 0) continue;
    unwrap(
      await moveLines(ctx, {
        lines: tracked,
        sourceEntity: 'sales.order',
        sourceId: sale.id,
        reference: sale.number ?? '',
        fromLocationId: wh.internalLocationId,
        toLocationId: wh.customerLocationId,
        post: false,
      }),
      'sales moves',
    );
    const drafts = await ctx.tx
      .select({ id: stockMoves.id })
      .from(stockMoves)
      .where(and(eq(stockMoves.sourceEntity, 'sales.order'), eq(stockMoves.sourceId, sale.id), eq(stockMoves.state, 'draft')));
    for (const move of drafts) unwrap(await validateMove(ctx, move.id), 'validate sales move');
    if (drafts.length > 0) report.salesOrders += 1;
  }

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
