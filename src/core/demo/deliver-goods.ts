// Outgoing stock for demo companies: credit contract deliveries and sales order deliveries.
// Shared by the sample data seeder and the stock repair. Every step goes through the real services,
// which skip what already exists (by source and product), so a second run creates nothing new.
import { and, eq, inArray, ne } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { partners } from '@/modules/contacts/schema';
import { creditContracts, creditContractLines } from '@/modules/credit_sales/schema';
import { deliveries } from '@/modules/inventory/schema';
import { stockTrackedLines } from '@/modules/inventory/service/moves';
import {
  createDraftDelivery,
  createOrderDelivery,
  SALE_ORDER_SOURCE_ENTITY,
  setDeliverySignedBy,
  validateDelivery,
} from '@/modules/inventory/service/deliveries';
import { saleOrderLines, saleOrders } from '@/modules/sales/schema';

export interface DemoDeliveryReport {
  deliveries: number;
  salesOrders: number;
}

function fail(step: string, message: string): never {
  throw new Error(`${step}: ${message}`);
}

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }, step: string): T {
  if (!result.ok) fail(step, result.error.message);
  return result.value;
}

/** Credit contracts handed over and confirmed sales orders delivered in full, both through the delivery service. */
export async function deliverDemoGoods(ctx: Ctx): Promise<DemoDeliveryReport> {
  const report: DemoDeliveryReport = { deliveries: 0, salesOrders: 0 };

  // Credit contracts: draft delivery, signed by the customer, then validated.
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

  // Sales orders: confirmation already opened a draft delivery per order (inventory event). Sign and
  // validate it in full. Orders confirmed before that handler existed get their delivery created here.
  const sales = await ctx.tx
    .select({ id: saleOrders.id, partnerId: saleOrders.partnerId })
    .from(saleOrders)
    .where(and(eq(saleOrders.companyId, ctx.companyId), inArray(saleOrders.state, ['confirmed', 'done'])));
  for (const sale of sales) {
    const anyDelivery = await ctx.tx
      .select({ id: deliveries.id })
      .from(deliveries)
      .where(
        and(
          eq(deliveries.companyId, ctx.companyId),
          eq(deliveries.sourceEntity, SALE_ORDER_SOURCE_ENTITY),
          eq(deliveries.sourceId, sale.id),
          ne(deliveries.state, 'cancelled'),
        ),
      )
      .limit(1);
    if (anyDelivery.length === 0) {
      const lines = await ctx.tx
        .select({ id: saleOrderLines.id, productId: saleOrderLines.productId, quantity: saleOrderLines.quantity })
        .from(saleOrderLines)
        .where(eq(saleOrderLines.orderId, sale.id));
      const tracked = await stockTrackedLines(ctx, lines);
      if (tracked.length === 0) continue;
      unwrap(
        await createOrderDelivery(ctx, {
          partnerId: sale.partnerId,
          sourceEntity: SALE_ORDER_SOURCE_ENTITY,
          sourceId: sale.id,
          lines: tracked.map((l) => ({ productId: l.productId ?? '', quantity: l.quantity, saleOrderLineId: l.id })),
        }),
        'sales delivery',
      );
    }
    const open = await ctx.tx
      .select({ id: deliveries.id, signedByName: deliveries.signedByName })
      .from(deliveries)
      .where(
        and(
          eq(deliveries.companyId, ctx.companyId),
          eq(deliveries.sourceEntity, SALE_ORDER_SOURCE_ENTITY),
          eq(deliveries.sourceId, sale.id),
          inArray(deliveries.state, ['draft', 'ready']),
        ),
      );
    if (open.length === 0) continue;
    const [customer] = await ctx.tx
      .select({ name: partners.displayName })
      .from(partners)
      .where(eq(partners.id, sale.partnerId));
    for (const delivery of open) {
      if (!delivery.signedByName && customer) {
        unwrap(await setDeliverySignedBy(ctx, { deliveryId: delivery.id, signedByName: customer.name }), 'sales delivery signer');
      }
      unwrap(await validateDelivery(ctx, delivery.id), 'validate sales delivery');
    }
    report.salesOrders += 1;
  }

  return report;
}
