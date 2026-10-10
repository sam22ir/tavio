import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { Ctx } from '@/core/ctx';
import { audit } from '@/core/audit';
import { emit } from '@/core/events';
import { parseDzd, type Cents } from '@/core/money';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import type { ListQuery, ListResult, Row } from '@/core/entities/types';
import { nextNumber } from '@/core/sequences';
import { partners } from '@/modules/contacts/schema';
import { products } from '@/modules/products/schema';
import { taxes } from '@/modules/l10n_dz/schema';
import { createInvoice } from '@/modules/invoicing/service/create';
import { postMessage } from '@/modules/chatter/service';
import { saleOrderLines, saleOrders } from '../schema';
import { computeOrderTotals, type LineInput, type OrderTotals } from './totals';

const ENTITY = 'sales.order';
const EDITABLE_STATES = ['draft', 'sent'] as const;
const CANCELLABLE_STATES = ['draft', 'sent', 'confirmed'] as const;

export const saleLineInput = z.object({
  productId: z.uuid().nullable().optional(),
  description: z.string().trim().min(1).max(300),
  quantity: z.string().trim().min(1).max(20),
  // DZD as text, e.g. "1500,50"
  unitPrice: z.string().trim().min(1).max(20),
  // Percent as text, empty means 0
  discount: z.string().trim().max(10).optional(),
  taxId: z.uuid().nullable().optional(),
});

export const saleOrderInput = z.object({
  partnerId: z.uuid(),
  orderDate: z.iso.date(),
  validityDate: z.iso.date().nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
  lines: z.array(saleLineInput).min(1).max(200),
});
export type SaleOrderInput = z.infer<typeof saleOrderInput>;
export type SaleLineInput = z.infer<typeof saleLineInput>;

export interface SaleOrderSaved { id: string; number: string | null; totalCents: Cents }

const ALLOWED_SORT: Record<string, SQL> = {
  number: sql`${saleOrders.number}`,
  orderDate: sql`${saleOrders.orderDate}`,
  totalCents: sql`${saleOrders.totalCents}`,
  state: sql`${saleOrders.state}`,
};

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

interface PreparedLines {
  rows: LineInput[];
  taxIds: (string | null)[];
}

/** Resolves taxes and products for this company and parses DZD prices. Returns VALIDATION or NOT_FOUND errors. */
async function prepareLines(ctx: Ctx, lines: readonly SaleLineInput[]): Promise<Result<PreparedLines>> {
  const taxIds = [...new Set(lines.map((l) => l.taxId).filter((v): v is string => !!v))];
  const taxRows = taxIds.length
    ? await ctx.tx
        .select({ id: taxes.id, rate: taxes.rate, scope: taxes.scope, active: taxes.active })
        .from(taxes)
        .where(and(eq(taxes.companyId, ctx.companyId), inArray(taxes.id, taxIds)))
    : [];
  const taxById = new Map(taxRows.map((t) => [t.id, t]));

  const productIds = [...new Set(lines.map((l) => l.productId).filter((v): v is string => !!v))];
  if (productIds.length) {
    const found = await ctx.tx
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.companyId, ctx.companyId), inArray(products.id, productIds)));
    if (found.length !== productIds.length) return err('NOT_FOUND', 'PRODUCT_NOT_FOUND');
  }

  const rows: LineInput[] = [];
  for (const line of lines) {
    const price: Cents | null = parseDzd(line.unitPrice);
    if (price === null) return err('VALIDATION', 'INVALID_AMOUNT', { field: 'unitPrice' });
    let taxRate: string | null = null;
    if (line.taxId) {
      const tax = taxById.get(line.taxId);
      if (!tax) return err('NOT_FOUND', 'TAX_NOT_FOUND');
      if (!tax.active || (tax.scope !== 'sale' && tax.scope !== 'both')) {
        return err('VALIDATION', 'TAX_NOT_FOR_SALES', { field: 'taxId' });
      }
      taxRate = tax.rate;
    }
    rows.push({
      quantity: line.quantity,
      unitPriceCents: price,
      discountRate: line.discount ?? '',
      taxRate,
    });
  }
  return ok({ rows, taxIds: lines.map((l) => l.taxId ?? null) });
}

/** Computes totals from prepared lines, mapping bad quantities or discounts to VALIDATION. */
function totalsOrError(rows: LineInput[]): Result<OrderTotals> {
  try {
    return ok(computeOrderTotals(rows));
  } catch (e) {
    return err('VALIDATION', e instanceof Error ? e.message : 'INVALID_LINE');
  }
}

async function insertLines(
  ctx: Ctx,
  orderId: string,
  input: SaleOrderInput,
  prepared: PreparedLines,
  totals: OrderTotals,
): Promise<void> {
  await ctx.tx.insert(saleOrderLines).values(
    input.lines.map((line, i) => ({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      orderId,
      productId: line.productId ?? null,
      description: line.description,
      quantity: line.quantity,
      unitPriceCents: prepared.rows[i]!.unitPriceCents,
      discountRate: line.discount && line.discount !== '' ? line.discount : '0',
      taxId: prepared.taxIds[i] ?? null,
      subtotalCents: totals.lines[i]!.subtotalCents,
      taxCents: totals.lines[i]!.taxCents,
    })),
  );
}

async function loadOrderForUpdate(ctx: Ctx, id: string) {
  const [order] = await ctx.tx
    .select()
    .from(saleOrders)
    .where(and(eq(saleOrders.id, id), eq(saleOrders.companyId, ctx.companyId)))
    .for('update');
  return order;
}

const UUID_FILTER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listSaleOrders(ctx: Ctx, q: ListQuery): Promise<Result<ListResult>> {
  const perm = requirePerm(ctx, 'sales.order.read');
  if (!perm.ok) return perm;

  const conds: SQL[] = [eq(saleOrders.companyId, ctx.companyId)];
  if (q.q) {
    const pattern = `%${escapeLike(q.q)}%`;
    const search = or(ilike(saleOrders.number, pattern), ilike(partners.displayName, pattern));
    if (search) conds.push(search);
  }
  if (q.filters.state) conds.push(eq(saleOrders.state, q.filters.state));
  if (q.filters.invoiced === 'true') conds.push(eq(saleOrders.invoiced, true));
  if (q.filters.invoiced === 'false') conds.push(eq(saleOrders.invoiced, false));
  if (q.filters.partnerId && UUID_FILTER.test(q.filters.partnerId)) conds.push(eq(saleOrders.partnerId, q.filters.partnerId));
  if (q.filters.productId && UUID_FILTER.test(q.filters.productId)) {
    conds.push(inArray(saleOrders.id, ctx.tx.select({ id: saleOrderLines.orderId }).from(saleOrderLines).where(eq(saleOrderLines.productId, q.filters.productId))));
  }
  const where = and(...conds);

  const sortCol: SQL = (q.sort && ALLOWED_SORT[q.sort]) || sql`${saleOrders.orderDate}`;
  const order = q.dir === 'asc' ? asc(sortCol) : desc(sortCol);

  const [countRow] = await ctx.tx
    .select({ n: sql<number>`count(*)::int` })
    .from(saleOrders)
    .innerJoin(partners, eq(partners.id, saleOrders.partnerId))
    .where(where);
  const rows = await ctx.tx
    .select({
      id: saleOrders.id,
      number: saleOrders.number,
      partnerId: saleOrders.partnerId,
      partnerIdLabel: partners.displayName,
      state: saleOrders.state,
      orderDate: saleOrders.orderDate,
      validityDate: saleOrders.validityDate,
      totalCents: saleOrders.totalCents,
      invoiced: saleOrders.invoiced,
    })
    .from(saleOrders)
    .innerJoin(partners, eq(partners.id, saleOrders.partnerId))
    .where(where)
    .orderBy(order, desc(saleOrders.id))
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize);

  return ok({ rows: rows as Row[], total: countRow?.n ?? 0, page: q.page, pageSize: q.pageSize });
}

export interface SaleOrderDetail {
  order: Row;
  lines: Row[];
  partnerName: string;
}

export async function getSaleOrder(ctx: Ctx, id: string): Promise<Result<SaleOrderDetail>> {
  const perm = requirePerm(ctx, 'sales.order.read');
  if (!perm.ok) return perm;

  const [order] = await ctx.tx
    .select({ order: saleOrders, partnerName: partners.displayName })
    .from(saleOrders)
    .innerJoin(partners, eq(partners.id, saleOrders.partnerId))
    .where(and(eq(saleOrders.id, id), eq(saleOrders.companyId, ctx.companyId)));
  if (!order) return err('NOT_FOUND', 'ORDER_NOT_FOUND');

  const lines = await ctx.tx
    .select({
      id: saleOrderLines.id,
      productId: saleOrderLines.productId,
      description: saleOrderLines.description,
      quantity: saleOrderLines.quantity,
      unitPriceCents: saleOrderLines.unitPriceCents,
      discountRate: saleOrderLines.discountRate,
      taxId: saleOrderLines.taxId,
      taxRate: taxes.rate,
      subtotalCents: saleOrderLines.subtotalCents,
      taxCents: saleOrderLines.taxCents,
    })
    .from(saleOrderLines)
    .leftJoin(taxes, eq(taxes.id, saleOrderLines.taxId))
    .where(and(eq(saleOrderLines.orderId, id), eq(saleOrderLines.companyId, ctx.companyId)))
    .orderBy(asc(saleOrderLines.id));

  return ok({ order: order.order as Row, lines: lines as Row[], partnerName: order.partnerName });
}

export async function createSaleOrder(ctx: Ctx, input: SaleOrderInput): Promise<Result<SaleOrderSaved>> {
  const perm = requirePerm(ctx, 'sales.order.write');
  if (!perm.ok) return perm;

  const [partner] = await ctx.tx
    .select({ id: partners.id })
    .from(partners)
    .where(and(eq(partners.id, input.partnerId), eq(partners.companyId, ctx.companyId)));
  if (!partner) return err('NOT_FOUND', 'PARTNER_NOT_FOUND');

  const prepared = await prepareLines(ctx, input.lines);
  if (!prepared.ok) return prepared;
  const totals = totalsOrError(prepared.value.rows);
  if (!totals.ok) return totals;

  const [row] = await ctx.tx
    .insert(saleOrders)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      partnerId: input.partnerId,
      state: 'draft',
      orderDate: input.orderDate,
      validityDate: input.validityDate ?? null,
      salespersonId: ctx.userId,
      note: input.note ?? null,
      untaxedCents: totals.value.untaxedCents,
      taxCents: totals.value.taxCents,
      totalCents: totals.value.totalCents,
    })
    .returning({ id: saleOrders.id });
  if (!row) return err('INTERNAL', 'INSERT_FAILED');

  await insertLines(ctx, row.id, input, prepared.value, totals.value);
  await audit(ctx, { action: 'create', entity: ENTITY, recordId: row.id, after: { totalCents: totals.value.totalCents } });
  return ok({ id: row.id, number: null, totalCents: totals.value.totalCents });
}

/** Edits a draft or quotation. Confirmed, cancelled and done orders return POSTED_IMMUTABLE. */
export async function updateSaleOrder(
  ctx: Ctx,
  id: string,
  input: SaleOrderInput,
): Promise<Result<SaleOrderSaved>> {
  const perm = requirePerm(ctx, 'sales.order.write');
  if (!perm.ok) return perm;

  const order = await loadOrderForUpdate(ctx, id);
  if (!order) return err('NOT_FOUND', 'ORDER_NOT_FOUND');
  if (!(EDITABLE_STATES as readonly string[]).includes(order.state)) {
    return err('POSTED_IMMUTABLE', 'ORDER_NOT_EDITABLE', { state: order.state });
  }

  const prepared = await prepareLines(ctx, input.lines);
  if (!prepared.ok) return prepared;
  const totals = totalsOrError(prepared.value.rows);
  if (!totals.ok) return totals;

  const before = { totalCents: order.totalCents };
  await ctx.tx.delete(saleOrderLines).where(eq(saleOrderLines.orderId, id));
  await ctx.tx
    .update(saleOrders)
    .set({
      partnerId: input.partnerId,
      orderDate: input.orderDate,
      validityDate: input.validityDate ?? null,
      note: input.note ?? null,
      untaxedCents: totals.value.untaxedCents,
      taxCents: totals.value.taxCents,
      totalCents: totals.value.totalCents,
      updatedAt: sql`now()`,
    })
    .where(eq(saleOrders.id, id));
  await insertLines(ctx, id, input, prepared.value, totals.value);
  await audit(ctx, {
    action: 'update',
    entity: ENTITY,
    recordId: id,
    before,
    after: { totalCents: totals.value.totalCents },
  });
  return ok({ id, number: order.number, totalCents: totals.value.totalCents });
}

/**
 * Creates an empty draft quotation for a partner, linked to the CRM lead it came from. Lines are added
 * afterwards with updateSaleOrder. Used by the CRM "new quote" action.
 */
export async function createDraftQuote(
  ctx: Ctx,
  input: { partnerId: string; leadId: string; salespersonId: string | null },
): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'sales.order.write');
  if (!perm.ok) return perm;
  const [partner] = await ctx.tx
    .select({ id: partners.id })
    .from(partners)
    .where(and(eq(partners.companyId, ctx.companyId), eq(partners.id, input.partnerId)));
  if (!partner) return err('NOT_FOUND', 'PARTNER_NOT_FOUND');

  const [row] = await ctx.tx
    .insert(saleOrders)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      partnerId: input.partnerId,
      leadId: input.leadId,
      state: 'draft',
      orderDate: new Date().toISOString().slice(0, 10),
      salespersonId: input.salespersonId,
      untaxedCents: BigInt(0),
      taxCents: BigInt(0),
      totalCents: BigInt(0),
    })
    .returning({ id: saleOrders.id });
  if (!row) return err('INTERNAL', 'insert failed');

  await audit(ctx, {
    action: 'create',
    entity: ENTITY,
    recordId: row.id,
    after: { state: 'draft', leadId: input.leadId, partnerId: input.partnerId },
  });
  return ok({ id: row.id });
}

/** Draft to sent: the quotation was handed to the customer. */
export async function markOrderSent(ctx: Ctx, id: string): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'sales.order.write');
  if (!perm.ok) return perm;
  const order = await loadOrderForUpdate(ctx, id);
  if (!order) return err('NOT_FOUND', 'ORDER_NOT_FOUND');
  if (order.state !== 'draft') return err('STATE', 'ORDER_NOT_DRAFT', { state: order.state });
  await ctx.tx.update(saleOrders).set({ state: 'sent', updatedAt: sql`now()` }).where(eq(saleOrders.id, id));
  await audit(ctx, { action: 'send', entity: ENTITY, recordId: id, before: { state: 'draft' }, after: { state: 'sent' } });
  return ok({ id });
}

/** Confirms a draft or sent quotation: assigns SO-{YYYY}-NNNNN and emits sales.order.confirmed. */
export async function confirmOrder(ctx: Ctx, id: string): Promise<Result<{ id: string; number: string }>> {
  const perm = requirePerm(ctx, 'sales.order.post');
  if (!perm.ok) return perm;

  const order = await loadOrderForUpdate(ctx, id);
  if (!order) return err('NOT_FOUND', 'ORDER_NOT_FOUND');
  if (!(EDITABLE_STATES as readonly string[]).includes(order.state)) {
    return err('STATE', 'ORDER_NOT_CONFIRMABLE', { state: order.state });
  }

  const lines = await ctx.tx
    .select({ productId: saleOrderLines.productId, quantity: saleOrderLines.quantity })
    .from(saleOrderLines)
    .where(eq(saleOrderLines.orderId, id));
  if (lines.length === 0) return err('VALIDATION', 'ORDER_HAS_NO_LINES');

  const number = await nextNumber(ctx, 'sales.order', { prefix: 'SO-{YYYY}-', padding: 5 });
  await ctx.tx
    .update(saleOrders)
    .set({ state: 'confirmed', number, updatedAt: sql`now()` })
    .where(eq(saleOrders.id, id));
  await audit(ctx, {
    action: 'confirm',
    entity: ENTITY,
    recordId: id,
    before: { state: order.state },
    after: { state: 'confirmed', number },
  });
  await emit(ctx, {
    name: 'sales.order.confirmed',
    payload: { orderId: id, partnerId: order.partnerId, number, lines },
  });
  return ok({ id, number });
}

export async function cancelOrder(ctx: Ctx, id: string): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'sales.order.cancel');
  if (!perm.ok) return perm;

  const order = await loadOrderForUpdate(ctx, id);
  if (!order) return err('NOT_FOUND', 'ORDER_NOT_FOUND');
  if (order.invoiced) return err('STATE', 'ORDER_ALREADY_INVOICED');
  if (!(CANCELLABLE_STATES as readonly string[]).includes(order.state)) {
    return err('STATE', 'ORDER_NOT_CANCELLABLE', { state: order.state });
  }

  await ctx.tx
    .update(saleOrders)
    .set({ state: 'cancelled', updatedAt: sql`now()` })
    .where(eq(saleOrders.id, id));
  await audit(ctx, {
    action: 'cancel',
    entity: ENTITY,
    recordId: id,
    before: { state: order.state },
    after: { state: 'cancelled' },
  });
  // A cancelled quote only leaves a note on its lead. The lead's stage does not change.
  if (order.leadId) {
    const note = await postMessage(ctx, {
      entity: 'crm.lead',
      recordId: order.leadId,
      kind: 'system',
      body: `Quote ${order.number ?? id.slice(0, 8)} cancelled`,
    });
    if (!note.ok) return note;
  }
  return ok({ id });
}

/** Creates a draft out_invoice through the invoicing stub, then marks the order invoiced and done. */
export async function createInvoiceFromOrder(ctx: Ctx, id: string): Promise<Result<{ invoiceId: string }>> {
  const perm = requirePerm(ctx, 'sales.order.write');
  if (!perm.ok) return perm;

  const order = await loadOrderForUpdate(ctx, id);
  if (!order) return err('NOT_FOUND', 'ORDER_NOT_FOUND');
  if (order.state !== 'confirmed' || !order.number) return err('STATE', 'ORDER_NOT_CONFIRMED', { state: order.state });
  if (order.invoiced) return err('CONFLICT', 'ORDER_ALREADY_INVOICED');

  const lines = await ctx.tx
    .select()
    .from(saleOrderLines)
    .where(eq(saleOrderLines.orderId, id))
    .orderBy(asc(saleOrderLines.id));

  const created = await createInvoice(ctx, {
    type: 'out_invoice',
    partnerId: order.partnerId,
    origin: order.number,
    sourceEntity: ENTITY,
    sourceId: id,
    lines: lines.map((l) => ({
      productId: l.productId,
      description: l.description,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      discountRate: l.discountRate,
      taxId: l.taxId,
    })),
  });
  if (!created.ok) return created;

  await ctx.tx
    .update(saleOrders)
    .set({ invoiced: true, state: 'done', updatedAt: sql`now()` })
    .where(eq(saleOrders.id, id));
  await audit(ctx, {
    action: 'invoice',
    entity: ENTITY,
    recordId: id,
    after: { invoiceId: created.value.id },
  });
  return ok({ invoiceId: created.value.id });
}

export interface SaleLookups {
  partners: { value: string; label: string }[];
  taxes: { value: string; label: string; rate: string }[];
  products: { value: string; label: string; unitPrice: string; defaultTaxId: string | null }[];
}

/** Options for the order form: customers, sales taxes and active products. */
export async function saleLookups(ctx: Ctx): Promise<Result<SaleLookups>> {
  const perm = requirePerm(ctx, 'sales.order.read');
  if (!perm.ok) return perm;

  const partnerRows = await ctx.tx
    .select({ id: partners.id, displayName: partners.displayName })
    .from(partners)
    .where(and(eq(partners.companyId, ctx.companyId), eq(partners.active, true), eq(partners.isCustomer, true)))
    .orderBy(asc(partners.displayName))
    .limit(500);
  const taxRows = await ctx.tx
    .select({ id: taxes.id, name: taxes.name, rate: taxes.rate })
    .from(taxes)
    .where(
      and(
        eq(taxes.companyId, ctx.companyId),
        eq(taxes.active, true),
        inArray(taxes.scope, ['sale', 'both']),
      ),
    )
    .orderBy(asc(taxes.name));
  const productRows = await ctx.tx
    .select({
      id: products.id,
      name: products.name,
      salePriceCents: products.salePriceCents,
      defaultTaxId: products.defaultTaxId,
    })
    .from(products)
    .where(and(eq(products.companyId, ctx.companyId), eq(products.active, true)))
    .orderBy(asc(products.name))
    .limit(500);

  return ok({
    partners: partnerRows.map((p) => ({ value: p.id, label: p.displayName })),
    taxes: taxRows.map((t) => ({ value: t.id, label: `${t.name} (${t.rate}%)`, rate: t.rate })),
    products: productRows.map((p) => ({
      value: p.id,
      label: p.name,
      unitPrice: (p.salePriceCents / BigInt(100)).toString() + ',' + (p.salePriceCents % BigInt(100)).toString().padStart(2, '0'),
      defaultTaxId: p.defaultTaxId,
    })),
  });
}
