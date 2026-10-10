// Purchase orders service (W5-D). Signatures are the contract for actions and the integrator.
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { emit } from '@/core/events';
import type { ListQuery, ListResult } from '@/core/entities/types';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { nextNumber } from '@/core/sequences';
import { partners } from '@/modules/contacts/schema';
import { taxes } from '@/modules/l10n_dz/schema';
import { products } from '@/modules/products/schema';
import { createInvoice } from '@/modules/invoicing/service/create';
import { invoices } from '@/modules/invoicing/schema';
import { purchaseOrderLines, purchaseOrders } from '../schema';
import { formatQty, isFullyBilled, lineAmounts, parseQty, remainingQty, sumTotals, unbilledQty, type LineAmounts } from './math';
import { canCancel, canConfirm, canEdit, canReceive, isBillableState } from './state';

const ENTITY = 'purchases.order';
const NUMBER_PREFIX = 'PO-{YYYY}-';
const LINE_STEP = 10;
const TZ = 'Africa/Algiers';
const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export interface OrderLineInput {
  productId: string | null;
  description: string;
  quantity: string;              // decimal string, up to 3 decimals
  unitPriceCents: bigint;
  taxId: string | null;
}
export interface OrderInput {
  partnerId: string;
  expectedDate: string | null;   // YYYY-MM-DD
  note: string | null;
  lines: OrderLineInput[];
}
export interface ReceiveLineInput { lineId: string; quantity: string }
export interface OrderListRow {
  id: string;
  number: string | null;
  partnerName: string;
  state: string;
  orderDate: string;
  totalCents: string;
  [key: string]: unknown;
}
export interface OrderBillRow {
  id: string;
  number: string | null;
  date: string;
  state: string;
  totalCents: bigint;
}
export interface OrderDetail {
  order: typeof purchaseOrders.$inferSelect;
  partnerName: string;
  lines: (typeof purchaseOrderLines.$inferSelect & { productName: string | null; taxRate: string | null })[];
  bills: OrderBillRow[];
}

const today = (): string => DAY_FORMAT.format(new Date());

/** Loads the order inside the transaction with a row lock, scoped to the tenant. */
async function lockOrder(ctx: Ctx, id: string): Promise<typeof purchaseOrders.$inferSelect | null> {
  const [row] = await ctx.tx
    .select()
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.companyId, ctx.companyId)))
    .for('update');
  return row ?? null;
}

/** Resolves tax rates for the given tax ids in this company. Returns null when one id is unknown. */
async function taxRates(ctx: Ctx, ids: readonly string[]): Promise<Map<string, string> | null> {
  const unique = [...new Set(ids)];
  const rates = new Map<string, string>();
  if (unique.length === 0) return rates;
  const rows = await ctx.tx
    .select({ id: taxes.id, rate: taxes.rate })
    .from(taxes)
    .where(and(eq(taxes.companyId, ctx.companyId), inArray(taxes.id, unique)));
  if (rows.length !== unique.length) return null;
  for (const row of rows) rates.set(row.id, row.rate);
  return rates;
}

function validateLines(input: OrderInput): Result<true> {
  if (input.lines.length === 0) return err('VALIDATION', 'an order needs at least one line');
  for (const line of input.lines) {
    if (parseQty(line.quantity) === null) return err('VALIDATION', `invalid quantity "${line.quantity}"`);
    if (line.unitPriceCents < BigInt(0)) return err('VALIDATION', 'unit price must be >= 0');
    if (line.description.trim() === '') return err('VALIDATION', 'line description is required');
  }
  return ok(true);
}

/** Computes amounts for each line (tax rate from the tax row). */
async function computeLines(
  ctx: Ctx,
  lines: OrderLineInput[],
): Promise<Result<{ amounts: LineAmounts[]; rates: (string | null)[] }>> {
  const rateMap = await taxRates(ctx, lines.flatMap((l) => (l.taxId ? [l.taxId] : [])));
  if (rateMap === null) return err('VALIDATION', 'unknown tax');
  const rates = lines.map((l) => (l.taxId ? (rateMap.get(l.taxId) ?? null) : null));
  const amounts = lines.map((l, i) =>
    lineAmounts({ quantity: l.quantity, unitPriceCents: l.unitPriceCents, ratePercent: rates[i] ?? null }),
  );
  return ok({ amounts, rates });
}

async function insertLines(ctx: Ctx, orderId: string, input: OrderInput, amounts: LineAmounts[]): Promise<void> {
  if (input.lines.length === 0) return;
  await ctx.tx.insert(purchaseOrderLines).values(
    input.lines.map((line, i) => ({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      orderId,
      sequence: (i + 1) * LINE_STEP,
      productId: line.productId,
      description: line.description.trim(),
      quantity: formatQty(parseQty(line.quantity) ?? BigInt(0)),
      unitPriceCents: line.unitPriceCents,
      taxId: line.taxId,
      subtotalCents: amounts[i]?.subtotalCents ?? BigInt(0),
      taxCents: amounts[i]?.taxCents ?? BigInt(0),
    })),
  );
}

/** Creates a draft order. No number until confirm. */
export async function createOrder(ctx: Ctx, input: OrderInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'purchases.order.write');
  if (!perm.ok) return perm;
  const valid = validateLines(input);
  if (!valid.ok) return valid;

  const [partner] = await ctx.tx
    .select({ id: partners.id })
    .from(partners)
    .where(and(eq(partners.id, input.partnerId), eq(partners.companyId, ctx.companyId), eq(partners.active, true)));
  if (!partner) return err('NOT_FOUND', 'supplier not found');

  const computed = await computeLines(ctx, input.lines);
  if (!computed.ok) return computed;
  const totals = sumTotals(computed.value.amounts);

  const [row] = await ctx.tx
    .insert(purchaseOrders)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      partnerId: input.partnerId,
      state: 'draft',
      orderDate: today(),
      expectedDate: input.expectedDate,
      note: input.note,
      untaxedCents: totals.untaxedCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
    })
    .returning({ id: purchaseOrders.id });
  if (!row) return err('INTERNAL', 'insert failed');

  await insertLines(ctx, row.id, input, computed.value.amounts);
  await audit(ctx, { action: 'create', entity: ENTITY, recordId: row.id, after: { partnerId: input.partnerId } });
  return ok({ id: row.id });
}

/** Replaces header and lines of a draft. Confirmed or later orders return POSTED_IMMUTABLE. */
export async function updateOrder(ctx: Ctx, id: string, input: OrderInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'purchases.order.write');
  if (!perm.ok) return perm;
  const valid = validateLines(input);
  if (!valid.ok) return valid;

  const order = await lockOrder(ctx, id);
  if (!order) return err('NOT_FOUND', 'order not found');
  if (!canEdit(order.state)) return err('POSTED_IMMUTABLE', 'order is no longer a draft');

  const computed = await computeLines(ctx, input.lines);
  if (!computed.ok) return computed;
  const totals = sumTotals(computed.value.amounts);

  await ctx.tx.delete(purchaseOrderLines).where(eq(purchaseOrderLines.orderId, id));
  await insertLines(ctx, id, input, computed.value.amounts);
  await ctx.tx
    .update(purchaseOrders)
    .set({
      partnerId: input.partnerId,
      expectedDate: input.expectedDate,
      note: input.note,
      untaxedCents: totals.untaxedCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      updatedAt: sql`now()`,
    })
    .where(eq(purchaseOrders.id, id));
  await audit(ctx, { action: 'update', entity: ENTITY, recordId: id, after: { totalCents: totals.totalCents.toString() } });
  return ok({ id });
}

/** Assigns the gap-free number and moves a draft to confirmed. */
export async function confirmOrder(ctx: Ctx, id: string): Promise<Result<{ id: string; number: string }>> {
  const perm = requirePerm(ctx, 'purchases.order.post');
  if (!perm.ok) return perm;

  const order = await lockOrder(ctx, id);
  if (!order) return err('NOT_FOUND', 'order not found');
  if (!canConfirm(order.state)) return err('CONFLICT', 'order cannot be confirmed in this state');

  const [lineCount] = await ctx.tx
    .select({ count: sql<number>`count(*)::int` })
    .from(purchaseOrderLines)
    .where(eq(purchaseOrderLines.orderId, id));
  if (!lineCount || lineCount.count === 0) return err('CONFLICT', 'order has no lines');

  const number = await nextNumber(ctx, ENTITY, { prefix: NUMBER_PREFIX, padding: 5 });
  await ctx.tx
    .update(purchaseOrders)
    .set({ state: 'confirmed', number, updatedAt: sql`now()` })
    .where(eq(purchaseOrders.id, id));
  await audit(ctx, { action: 'confirm', entity: ENTITY, recordId: id, before: { state: order.state }, after: { state: 'confirmed', number } });
  return ok({ id, number });
}

/** Cancels a draft or confirmed order that has nothing received. */
export async function cancelOrder(ctx: Ctx, id: string): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'purchases.order.cancel');
  if (!perm.ok) return perm;

  const order = await lockOrder(ctx, id);
  if (!order) return err('NOT_FOUND', 'order not found');

  const [received] = await ctx.tx
    .select({ n: sql<number>`count(*)::int` })
    .from(purchaseOrderLines)
    .where(and(eq(purchaseOrderLines.orderId, id), sql`${purchaseOrderLines.receivedQty} > 0`));
  if (!canCancel(order.state, (received?.n ?? 0) > 0)) return err('CONFLICT', 'order cannot be cancelled');

  await ctx.tx
    .update(purchaseOrders)
    .set({ state: 'cancelled', updatedAt: sql`now()` })
    .where(eq(purchaseOrders.id, id));
  await audit(ctx, { action: 'cancel', entity: ENTITY, recordId: id, before: { state: order.state }, after: { state: 'cancelled' } });
  return ok({ id });
}

/**
 * Receives goods. `lines` omitted means receive every remaining quantity (full receipt).
 * Partial receipts keep the order confirmed; the order becomes received once every line is complete.
 * Emits purchases.order.received with the quantities received in this call.
 */
export async function receiveOrder(
  ctx: Ctx,
  id: string,
  lines?: ReceiveLineInput[],
): Promise<Result<{ id: string; state: string }>> {
  const perm = requirePerm(ctx, 'purchases.order.post');
  if (!perm.ok) return perm;

  const order = await lockOrder(ctx, id);
  if (!order) return err('NOT_FOUND', 'order not found');
  if (!canReceive(order.state)) return err('CONFLICT', 'order is not ready for receipt');

  const rows = await ctx.tx
    .select()
    .from(purchaseOrderLines)
    .where(eq(purchaseOrderLines.orderId, id))
    .for('update');
  const byId = new Map(rows.map((r) => [r.id, r]));

  // Quantity to add per line, in thousandths
  const toAdd = new Map<string, bigint>();
  if (lines === undefined) {
    for (const row of rows) {
      const left = remainingQty(row.quantity, row.receivedQty);
      if (left > BigInt(0)) toAdd.set(row.id, left);
    }
  } else {
    for (const input of lines) {
      const row = byId.get(input.lineId);
      if (!row) return err('NOT_FOUND', 'order line not found');
      const qty = parseQty(input.quantity);
      if (qty === null) return err('VALIDATION', `invalid quantity "${input.quantity}"`);
      if (qty > remainingQty(row.quantity, row.receivedQty)) {
        return err('CONFLICT', 'received quantity exceeds the quantity left to receive', { lineId: input.lineId });
      }
      toAdd.set(row.id, (toAdd.get(row.id) ?? BigInt(0)) + qty);
    }
  }
  if (toAdd.size === 0) return err('CONFLICT', 'nothing left to receive');

  const received: { productId: string | null; quantity: string }[] = [];
  for (const [lineId, qty] of toAdd) {
    const row = byId.get(lineId);
    if (!row) continue;
    const total = (parseQty(row.receivedQty) ?? BigInt(0)) + qty;
    await ctx.tx
      .update(purchaseOrderLines)
      .set({ receivedQty: formatQty(total), updatedAt: sql`now()` })
      .where(eq(purchaseOrderLines.id, lineId));
    received.push({ productId: row.productId, quantity: formatQty(qty) });
  }

  const complete = rows.every((r) => {
    const after = (toAdd.get(r.id) ?? BigInt(0)) + (parseQty(r.receivedQty) ?? BigInt(0));
    return after >= (parseQty(r.quantity) ?? BigInt(0));
  });
  const state = complete ? 'received' : 'confirmed';
  await ctx.tx
    .update(purchaseOrders)
    .set({ state, updatedAt: sql`now()` })
    .where(eq(purchaseOrders.id, id));

  await audit(ctx, { action: 'receive', entity: ENTITY, recordId: id, after: { state, lines: received } });
  await emit(ctx, {
    name: 'purchases.order.received',
    payload: { orderId: id, number: order.number ?? '', lines: received },
  });
  return ok({ id, state });
}

/** Creates a vendor bill (in_invoice) for the quantities received so far. */
export async function createBillFromOrder(ctx: Ctx, id: string): Promise<Result<{ invoiceId: string }>> {
  const perm = requirePerm(ctx, 'purchases.order.post');
  if (!perm.ok) return perm;

  const order = await lockOrder(ctx, id);
  if (!order) return err('NOT_FOUND', 'order not found');
  const rows = await ctx.tx
    .select()
    .from(purchaseOrderLines)
    .where(eq(purchaseOrderLines.orderId, id))
    .orderBy(purchaseOrderLines.sequence)
    .for('update');
  if (!isBillableState(order.state)) return err('CONFLICT', 'order cannot be billed in this state');

  // Bill what is received but not yet billed, per line. Lines with nothing to bill are skipped.
  const toBill = rows
    .map((r) => ({ row: r, qty: unbilledQty(r.receivedQty, r.billedQty) }))
    .filter((b) => b.qty > BigInt(0));
  if (toBill.length === 0) return err('CONFLICT', 'nothing received to bill');

  const result = await createInvoice(ctx, {
    type: 'in_invoice',
    partnerId: order.partnerId,
    origin: order.number ?? undefined,
    sourceEntity: ENTITY,
    sourceId: id,
    lines: toBill.map(({ row: r, qty }) => ({
      productId: r.productId,
      description: r.description,
      quantity: formatQty(qty),
      unitPriceCents: r.unitPriceCents,
      taxId: r.taxId,
    })),
  });
  if (!result.ok) return result;

  for (const { row: r, qty } of toBill) {
    await ctx.tx
      .update(purchaseOrderLines)
      .set({ billedQty: formatQty((parseQty(r.billedQty) ?? BigInt(0)) + qty), updatedAt: sql`now()` })
      .where(eq(purchaseOrderLines.id, r.id));
  }
  // Order flag: every line fully billed. See isFullyBilled in math.ts.
  const billedAfter = rows.map((r) => {
    const bill = toBill.find((b) => b.row.id === r.id);
    const billed = (parseQty(r.billedQty) ?? BigInt(0)) + (bill?.qty ?? BigInt(0));
    return { quantity: r.quantity, billedQty: formatQty(billed) };
  });
  await ctx.tx
    .update(purchaseOrders)
    .set({ billed: isFullyBilled(billedAfter), updatedAt: sql`now()` })
    .where(eq(purchaseOrders.id, id));
  await audit(ctx, { action: 'bill', entity: ENTITY, recordId: id, after: { invoiceId: result.value.id } });
  return ok({ invoiceId: result.value.id });
}

/** Header, lines with product name and tax rate, for the detail page. */
export async function getOrder(ctx: Ctx, id: string): Promise<Result<OrderDetail>> {
  const perm = requirePerm(ctx, 'purchases.order.read');
  if (!perm.ok) return perm;

  const [row] = await ctx.tx
    .select({ order: purchaseOrders, partnerName: partners.displayName })
    .from(purchaseOrders)
    .innerJoin(partners, eq(partners.id, purchaseOrders.partnerId))
    .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.companyId, ctx.companyId)));
  if (!row) return err('NOT_FOUND', 'order not found');

  const lines = await ctx.tx
    .select({
      line: purchaseOrderLines,
      productName: products.name,
      taxRate: taxes.rate,
    })
    .from(purchaseOrderLines)
    .leftJoin(products, eq(products.id, purchaseOrderLines.productId))
    .leftJoin(taxes, eq(taxes.id, purchaseOrderLines.taxId))
    .where(eq(purchaseOrderLines.orderId, id))
    .orderBy(purchaseOrderLines.sequence);

  const bills = await ctx.tx
    .select({
      id: invoices.id,
      number: invoices.number,
      date: invoices.date,
      state: invoices.state,
      totalCents: invoices.totalCents,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.companyId, ctx.companyId),
        eq(invoices.type, 'in_invoice'),
        eq(invoices.sourceEntity, ENTITY),
        eq(invoices.sourceId, id),
      ),
    )
    .orderBy(desc(invoices.date), desc(invoices.createdAt));

  return ok({
    order: row.order,
    partnerName: row.partnerName,
    lines: lines.map((l) => ({ ...l.line, productName: l.productName ?? null, taxRate: l.taxRate ?? null })),
    bills,
  });
}

/** Paginated list with search on number and supplier name, optional state filter. */
export async function listOrders(ctx: Ctx, query: ListQuery): Promise<Result<ListResult<OrderListRow>>> {
  const perm = requirePerm(ctx, 'purchases.order.read');
  if (!perm.ok) return perm;

  const conditions: SQL[] = [eq(purchaseOrders.companyId, ctx.companyId)];
  if (query.q) {
    const pattern = `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const search = or(ilike(purchaseOrders.number, pattern), ilike(partners.displayName, pattern));
    if (search) conditions.push(search);
  }
  const state = query.filters['state'];
  if (state) conditions.push(eq(purchaseOrders.state, state));

  const where = and(...conditions);
  const [counted] = await ctx.tx
    .select({ total: sql<number>`count(*)::int` })
    .from(purchaseOrders)
    .innerJoin(partners, eq(partners.id, purchaseOrders.partnerId))
    .where(where);
  const total = counted?.total ?? 0;

  const offset = (query.page - 1) * query.pageSize;
  const rows = await ctx.tx
    .select({
      id: purchaseOrders.id,
      number: purchaseOrders.number,
      partnerName: partners.displayName,
      state: purchaseOrders.state,
      orderDate: purchaseOrders.orderDate,
      totalCents: purchaseOrders.totalCents,
    })
    .from(purchaseOrders)
    .innerJoin(partners, eq(partners.id, purchaseOrders.partnerId))
    .where(where)
    .orderBy(desc(purchaseOrders.orderDate), desc(purchaseOrders.createdAt))
    .limit(query.pageSize)
    .offset(offset);

  return ok({
    rows: rows.map((r) => ({ ...r, totalCents: r.totalCents.toString() })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  });
}
