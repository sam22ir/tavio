// Outgoing stock for demo companies: credit contract deliveries and sales order moves.
// Shared by the sample data seeder and the stock repair. Every step goes through the real services,
// which skip what already exists (by source and product), so a second run creates nothing new.
import { and, eq, inArray } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { partners } from '@/modules/contacts/schema';
import { creditContracts, creditContractLines } from '@/modules/credit_sales/schema';
import { deliveries, stockMoves } from '@/modules/inventory/schema';
import { ensureDefaultWarehouse } from '@/modules/inventory/service/warehouses';
import { moveLines, stockTrackedLines, validateMove } from '@/modules/inventory/service/moves';
import { createDraftDelivery, setDeliverySignedBy, validateDelivery } from '@/modules/inventory/service/deliveries';
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

/** Credit contracts handed over (draft delivery, signed by the customer, validated) and confirmed sales orders (outgoing moves). */
export async function deliverDemoGoods(ctx: Ctx): Promise<DemoDeliveryReport> {
  const report: DemoDeliveryReport = { deliveries: 0, salesOrders: 0 };
  const wh = await ensureDefaultWarehouse(ctx);

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

  // Sales orders: outgoing moves for stock-tracked lines, validated (the seeded orders are past-dated).
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

  return report;
}
