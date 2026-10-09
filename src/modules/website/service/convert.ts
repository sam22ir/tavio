import { and, eq, inArray } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { partners } from '@/modules/contacts/schema';
import { createPartner } from '@/modules/contacts/service/partners';
import { products } from '@/modules/products/schema';
import { createSaleOrder, type SaleLineInput } from '@/modules/sales/service/orders';
import { webOrders } from '../schema';
import { nextOrderState, type WebOrderState } from './rules';
import type { WebOrderLine } from './orders';

// Integrator wiring: this is the only place where a web order reaches the sales service.
// It runs on the tenant ctx, so every write follows the sales permissions and events.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function centsToDzdText(cents: string): string {
  const value = BigInt(cents);
  const whole = value / 100n;
  const frac = (value % 100n).toString().padStart(2, '0');
  return `${whole}.${frac}`;
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? full.trim();
  const lastName = parts.slice(1).join(' ') || firstName;
  return { firstName, lastName };
}

/**
 * Converts a web order into a draft sale order. Idempotent: an order already linked to a sale order
 * returns that sale order. A "new" order moves to "confirmed". Matches each line to a product by id
 * when the product exists in this company, otherwise keeps the line as free text.
 */
export async function convertWebOrderToSale(
  ctx: Ctx,
  id: string,
): Promise<Result<{ saleOrderId: string; state: WebOrderState }>> {
  const perm = requirePerm(ctx, 'website.order.write');
  if (!perm.ok) return perm;

  const [row] = await ctx.tx
    .select()
    .from(webOrders)
    .where(and(eq(webOrders.id, id), eq(webOrders.companyId, ctx.companyId)))
    .for('update');
  if (!row) return err('NOT_FOUND', 'web order not found');

  const current = row.state as WebOrderState;
  if (row.saleOrderId) return ok({ saleOrderId: row.saleOrderId, state: current });
  if (current === 'cancelled') return err('STATE', 'web order is cancelled');

  const lines = (Array.isArray(row.lines) ? row.lines : []) as WebOrderLine[];
  if (lines.length === 0) return err('VALIDATION', 'web order has no lines');

  const partnerId = await findOrCreatePartner(ctx, row.phone, row.customerName, row.wilayaCode, row.address);
  if (!partnerId.ok) return partnerId;

  const candidateIds = [...new Set(lines.map((l) => l.productId).filter((v): v is string => UUID_RE.test(v ?? '')))];
  const known = new Set<string>();
  if (candidateIds.length > 0) {
    const found = await ctx.tx
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.companyId, ctx.companyId), inArray(products.id, candidateIds)));
    for (const p of found) known.add(p.id);
  }

  const saleLines: SaleLineInput[] = lines.map((l) => ({
    productId: l.productId && known.has(l.productId) ? l.productId : null,
    description: l.name,
    quantity: String(l.quantity),
    unitPrice: centsToDzdText(l.unitPriceCents),
    discount: '0',
    taxId: null,
  }));

  const today = new Date().toISOString().slice(0, 10);
  const sale = await createSaleOrder(ctx, {
    partnerId: partnerId.value,
    orderDate: today,
    note: `Web order ${row.number}`,
    lines: saleLines,
  });
  if (!sale.ok) return err(sale.error.code, sale.error.message, sale.error.details);

  const next = nextOrderState(current, 'confirm') ?? current;
  await ctx.tx
    .update(webOrders)
    .set({ saleOrderId: sale.value.id, state: next, updatedAt: new Date() })
    .where(eq(webOrders.id, id));
  await audit(ctx, {
    action: 'update',
    entity: 'website.web_order',
    recordId: id,
    before: { state: current, saleOrderId: null },
    after: { state: next, saleOrderId: sale.value.id },
  });
  return ok({ saleOrderId: sale.value.id, state: next });
}

async function findOrCreatePartner(
  ctx: Ctx,
  phone: string,
  customerName: string,
  wilayaCode: string,
  address: string,
): Promise<Result<string>> {
  const [existing] = await ctx.tx
    .select({ id: partners.id })
    .from(partners)
    .where(and(eq(partners.companyId, ctx.companyId), eq(partners.phone, phone)))
    .limit(1);
  if (existing) return ok(existing.id);

  const { firstName, lastName } = splitName(customerName);
  const created = await createPartner(ctx, {
    kind: 'individual',
    isCustomer: true,
    isSupplier: false,
    isProspect: false,
    firstName,
    lastName,
    phone,
    wilayaCode,
    address,
  });
  if (!created.ok) return err(created.error.code, created.error.message, created.error.details);
  return ok(created.value.id);
}
