// Draft purchase orders from an approved credit contract (W13-PO, PDF items 60-61).
// Called from the event handler in the approving transaction. No permission check: it runs as the system.
import { and, asc, eq, inArray } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { err, ok, type Result } from '@/core/result';
import { creditContractLines, creditContracts } from '@/modules/credit_sales/schema';
import { postMessage } from '@/modules/chatter/service';
import { partners } from '@/modules/contacts/schema';
import { products } from '@/modules/products/schema';
import { purchaseOrderLines, purchaseOrders, purchaseProductSuppliers } from '../schema';
import { formatQty, lineAmounts, parseQty, sumTotals } from './math';
import { splitBySupplier } from './supplier-split';

export const CONTRACT_ENTITY = 'credit_sales.contract';
const ORDER_ENTITY = 'purchases.order';
const LINE_STEP = 10;
const TZ = 'Africa/Algiers';
const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export interface ContractOrdersResult {
  orderIds: string[];
  skippedLineNos: number[];
}

/**
 * Creates one draft order per supplier for the contract lines. Lines without a preferred supplier are skipped and
 * noted in the contract chatter. Idempotent: if the contract already has orders, nothing is created.
 */
export async function createOrdersFromApprovedContract(
  ctx: Ctx,
  contractId: string,
): Promise<Result<ContractOrdersResult>> {
  const [contract] = await ctx.tx
    .select({ id: creditContracts.id, reference: creditContracts.reference })
    .from(creditContracts)
    .where(and(eq(creditContracts.id, contractId), eq(creditContracts.companyId, ctx.companyId)))
    .for('update');
  if (!contract) return err('NOT_FOUND', 'contract not found');

  const [existing] = await ctx.tx
    .select({ id: purchaseOrders.id })
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.companyId, ctx.companyId),
        eq(purchaseOrders.sourceEntity, CONTRACT_ENTITY),
        eq(purchaseOrders.sourceId, contractId),
      ),
    )
    .limit(1);
  if (existing) return ok({ orderIds: [], skippedLineNos: [] });

  const lines = await ctx.tx
    .select({
      lineNo: creditContractLines.lineNo,
      productId: creditContractLines.productId,
      description: creditContractLines.description,
      quantity: creditContractLines.quantity,
    })
    .from(creditContractLines)
    .where(and(eq(creditContractLines.contractId, contractId), eq(creditContractLines.companyId, ctx.companyId)))
    .orderBy(asc(creditContractLines.lineNo));

  const productIds = [...new Set(lines.flatMap((l) => (l.productId ? [l.productId] : [])))];
  const productRows = productIds.length
    ? await ctx.tx
        .select({ id: products.id, costCents: products.costCents })
        .from(products)
        .where(and(eq(products.companyId, ctx.companyId), inArray(products.id, productIds)))
    : [];
  const costs = new Map(productRows.map((p) => [p.id, p.costCents]));

  const supplierRows = productIds.length
    ? await ctx.tx
        .select({
          productId: purchaseProductSuppliers.productId,
          partnerId: purchaseProductSuppliers.partnerId,
          sequence: purchaseProductSuppliers.sequence,
        })
        .from(purchaseProductSuppliers)
        .innerJoin(partners, eq(partners.id, purchaseProductSuppliers.partnerId))
        .where(
          and(
            eq(purchaseProductSuppliers.companyId, ctx.companyId),
            eq(purchaseProductSuppliers.active, true),
            eq(partners.companyId, ctx.companyId),
            eq(partners.active, true),
            inArray(purchaseProductSuppliers.productId, productIds),
          ),
        )
    : [];

  const split = splitBySupplier(
    lines.map((l) => ({ lineNo: l.lineNo, productId: l.productId })),
    supplierRows,
  );
  const byLineNo = new Map(lines.map((l) => [l.lineNo, l]));
  const orderDate = DAY_FORMAT.format(new Date());
  const orderIds: string[] = [];

  for (const group of split.groups) {
    const groupLines = group.lineNos.flatMap((n) => {
      const line = byLineNo.get(n);
      return line ? [line] : [];
    });
    const priced = groupLines.map((line) => {
      const quantity = formatQty(parseQty(line.quantity) ?? BigInt(0));
      const unitPriceCents = costs.get(line.productId ?? '') ?? BigInt(0);
      return { line, quantity, unitPriceCents, amounts: lineAmounts({ quantity, unitPriceCents, ratePercent: null }) };
    });
    const totals = sumTotals(priced.map((p) => p.amounts));

    const [order] = await ctx.tx
      .insert(purchaseOrders)
      .values({
        companyId: ctx.companyId,
        createdBy: ctx.userId,
        partnerId: group.partnerId,
        state: 'draft',
        orderDate,
        note: `${CONTRACT_ENTITY} ${contract.reference}`,
        sourceEntity: CONTRACT_ENTITY,
        sourceId: contractId,
        untaxedCents: totals.untaxedCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
      })
      .returning({ id: purchaseOrders.id });
    if (!order) return err('INTERNAL', 'insert failed');

    await ctx.tx.insert(purchaseOrderLines).values(
      priced.map((p, i) => ({
        companyId: ctx.companyId,
        createdBy: ctx.userId,
        orderId: order.id,
        sequence: (i + 1) * LINE_STEP,
        productId: p.line.productId,
        description: p.line.description,
        quantity: p.quantity,
        unitPriceCents: p.unitPriceCents,
        taxId: null,
        subtotalCents: p.amounts.subtotalCents,
        taxCents: p.amounts.taxCents,
      })),
    );
    await audit(ctx, {
      action: 'create',
      entity: ORDER_ENTITY,
      recordId: order.id,
      after: { sourceEntity: CONTRACT_ENTITY, sourceId: contractId, partnerId: group.partnerId },
    });
    orderIds.push(order.id);
  }

  if (split.skippedLineNos.length > 0) {
    const posted = await postMessage(ctx, {
      entity: CONTRACT_ENTITY,
      recordId: contractId,
      kind: 'system',
      body: `No supplier found, no purchase order for line(s): ${split.skippedLineNos.join(', ')}`,
    });
    if (!posted.ok) return posted;
  }

  return ok({ orderIds, skippedLineNos: split.skippedLineNos });
}
