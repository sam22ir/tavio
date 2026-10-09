import { and, eq, inArray } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { emit } from '@/core/events';
import { parseDzd } from '@/core/money';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { nextNumber } from '@/core/sequences';
import { taxes } from '@/modules/l10n_dz/schema';
import { products } from '@/modules/products/schema';
import { posOrderLines, posOrders, posSessions } from '../schema';
import { changeDue, lineAmounts, orderTotals, parseQuantityMilli } from './totals';

export type PosMethod = 'cash' | 'cib' | 'edahabia';

export interface PayOrderInput {
  sessionId: string;
  method: PosMethod;
  partnerId?: string;
  tendered?: string;          // cash only, DZD text
  lines: { productId: string; quantity: string }[];
}

export interface PaidOrderResult {
  orderId: string;
  number: string;
  totalCents: bigint;
  changeCents: bigint | null;
}

/**
 * Creates a paid POS order. Prices and tax rates come from the database, never from the client.
 * The client's totals are not trusted; the server recomputes everything inside ctx.tx.
 */
export async function createPaidOrder(ctx: Ctx, input: PayOrderInput): Promise<Result<PaidOrderResult>> {
  const perm = requirePerm(ctx, 'pos.order.post');
  if (!perm.ok) return perm;

  const [session] = await ctx.tx
    .select()
    .from(posSessions)
    .where(and(eq(posSessions.id, input.sessionId), eq(posSessions.companyId, ctx.companyId)))
    .for('update');
  if (!session) return err('NOT_FOUND', 'SESSION_NOT_FOUND');
  if (session.state !== 'open') return err('STATE', 'SESSION_NOT_OPEN');

  // Merge repeated product lines and validate quantities.
  const merged = new Map<string, bigint>();
  for (const line of input.lines) {
    const qty = parseQuantityMilli(line.quantity);
    if (qty === null) return err('VALIDATION', 'INVALID_QUANTITY');
    merged.set(line.productId, (merged.get(line.productId) ?? BigInt(0)) + qty);
  }
  const productIds = [...merged.keys()];

  const productRows = await ctx.tx
    .select()
    .from(products)
    .where(and(eq(products.companyId, ctx.companyId), inArray(products.id, productIds)));
  if (productRows.length !== productIds.length) return err('NOT_FOUND', 'PRODUCT_NOT_FOUND');
  if (productRows.some((p) => !p.active)) return err('CONFLICT', 'PRODUCT_INACTIVE');

  const taxIds = productRows.map((p) => p.defaultTaxId).filter((id): id is string => id !== null);
  const taxRows = taxIds.length
    ? await ctx.tx
        .select({ id: taxes.id, rate: taxes.rate })
        .from(taxes)
        .where(and(eq(taxes.companyId, ctx.companyId), inArray(taxes.id, taxIds)))
    : [];
  const rateById = new Map(taxRows.map((t) => [t.id, t.rate]));

  const priced = productRows.map((p) => {
    const taxRate = (p.defaultTaxId && rateById.get(p.defaultTaxId)) || '0';
    const amounts = lineAmounts({
      unitPriceCents: p.salePriceCents,
      quantityMilli: merged.get(p.id) ?? BigInt(0),
      taxRate,
    });
    return { product: p, taxRate, ...amounts, quantity: formatQty(merged.get(p.id) ?? BigInt(0)) };
  });

  const totals = orderTotals(priced);

  let change: bigint | null = null;
  if (input.method === 'cash') {
    const tendered = input.tendered === undefined ? totals.totalCents : parseDzd(input.tendered);
    if (tendered === null) return err('VALIDATION', 'INVALID_AMOUNT');
    change = changeDue(totals.totalCents, tendered);
    if (change === null) return err('VALIDATION', 'INSUFFICIENT_TENDER');
  }

  const number = await nextNumber(ctx, 'pos.order', { prefix: 'POS-{YYYY}-', padding: 5 });

  const [order] = await ctx.tx
    .insert(posOrders)
    .values({
      companyId: ctx.companyId,
      sessionId: session.id,
      number,
      partnerId: input.partnerId ?? null,
      method: input.method,
      untaxedCents: totals.untaxedCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      createdBy: ctx.userId,
    })
    .returning({ id: posOrders.id });
  if (!order) return err('INTERNAL', 'INSERT_FAILED');

  await ctx.tx.insert(posOrderLines).values(
    priced.map((l) => ({
      companyId: ctx.companyId,
      orderId: order.id,
      productId: l.product.id,
      description: l.product.name,
      quantity: l.quantity,
      unitPriceCents: l.product.salePriceCents,
      taxRate: l.taxRate,
      subtotalCents: l.subtotalCents,
      taxCents: l.taxCents,
      createdBy: ctx.userId,
    })),
  );

  await audit(ctx, {
    action: 'create',
    entity: 'pos.order',
    recordId: order.id,
    after: { number, method: input.method, totalCents: totals.totalCents },
  });
  await emit(ctx, {
    name: 'pos.order.paid',
    payload: {
      orderId: order.id,
      sessionId: session.id,
      number,
      method: input.method,
      totalCents: totals.totalCents.toString(),
      untaxedCents: totals.untaxedCents.toString(),
      taxCents: totals.taxCents.toString(),
      lines: priced.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
    },
  });

  return ok({ orderId: order.id, number, totalCents: totals.totalCents, changeCents: change });
}

/** Formats thousandths as a decimal string with up to 3 places ("1500" -> "1.500"). */
function formatQty(milli: bigint): string {
  const whole = milli / BigInt(1000);
  const frac = (milli % BigInt(1000)).toString().padStart(3, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}
