// Smart buttons on a contact (partner) detail page. Side-effect file: imported by modules/relation-handlers.
import { and, count, eq, inArray } from 'drizzle-orm';
import { relations } from '@/core/relations';
import { leads } from '@/modules/crm/schema';
import { deliveries } from '@/modules/inventory/schema';
import { creditContracts } from '@/modules/credit_sales/schema';
import { invoicePayments, invoices } from '@/modules/invoicing/schema';
import { saleOrders } from '@/modules/sales/schema';
import { tickets } from '@/modules/helpdesk/schema';

async function countOf(query: Promise<{ value: number }[]>): Promise<number> {
  const [row] = await query;
  return row?.value ?? 0;
}

relations.register({
  id: 'contacts.partner->crm.lead',
  source: 'contacts.partner',
  labelKey: 'relations.contact.leads',
  icon: 'Handshake',
  perm: 'crm.lead.read',
  count: (ctx, id) =>
    countOf(ctx.tx.select({ value: count() }).from(leads)
      .where(and(eq(leads.companyId, ctx.companyId), eq(leads.partnerId, id)))),
  href: (locale, id) => `/${locale}/crm/list?f_partnerId=${id}`,
});

relations.register({
  id: 'contacts.partner->sales.order',
  source: 'contacts.partner',
  labelKey: 'relations.contact.orders',
  icon: 'ShoppingCart',
  perm: 'sales.order.read',
  count: (ctx, id) =>
    countOf(ctx.tx.select({ value: count() }).from(saleOrders)
      .where(and(eq(saleOrders.companyId, ctx.companyId), eq(saleOrders.partnerId, id)))),
  href: (locale, id) => `/${locale}/sales?f_partnerId=${id}`,
});

relations.register({
  id: 'contacts.partner->credit_sales.contract',
  source: 'contacts.partner',
  labelKey: 'relations.contact.contracts',
  icon: 'FileText',
  perm: 'credit_sales.contract.read',
  count: (ctx, id) =>
    countOf(ctx.tx.select({ value: count() }).from(creditContracts)
      .where(and(eq(creditContracts.companyId, ctx.companyId), eq(creditContracts.partnerId, id)))),
  href: (locale, id) => `/${locale}/credit/contracts?f_partnerId=${id}`,
});

relations.register({
  id: 'contacts.partner->invoicing.invoice',
  source: 'contacts.partner',
  labelKey: 'relations.contact.invoices',
  icon: 'Receipt',
  perm: 'invoicing.invoice.read',
  count: (ctx, id) =>
    countOf(ctx.tx.select({ value: count() }).from(invoices)
      .where(and(eq(invoices.companyId, ctx.companyId), eq(invoices.partnerId, id)))),
  href: (locale, id) => `/${locale}/invoicing/customers/${id}`,
});

relations.register({
  id: 'contacts.partner->invoicing.payment',
  source: 'contacts.partner',
  labelKey: 'relations.contact.payments',
  icon: 'CreditCard',
  perm: 'invoicing.invoice.read',
  count: (ctx, id) => {
    const partnerInvoices = ctx.tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.companyId, ctx.companyId), eq(invoices.partnerId, id)));
    return countOf(ctx.tx.select({ value: count() }).from(invoicePayments)
      .where(and(eq(invoicePayments.companyId, ctx.companyId), inArray(invoicePayments.invoiceId, partnerInvoices))));
  },
  href: (locale, id) => `/${locale}/invoicing/customers/${id}`,
});

relations.register({
  id: 'contacts.partner->helpdesk.ticket',
  source: 'contacts.partner',
  labelKey: 'relations.contact.tickets',
  icon: 'LifeBuoy',
  perm: 'helpdesk.ticket.read',
  count: (ctx, id) =>
    countOf(ctx.tx.select({ value: count() }).from(tickets)
      .where(and(eq(tickets.companyId, ctx.companyId), eq(tickets.partnerId, id)))),
  href: (locale, id) => `/${locale}/helpdesk/list?f_partnerId=${id}`,
});

relations.register({
  id: 'contacts.partner->inventory.delivery',
  source: 'contacts.partner',
  labelKey: 'relations.contact.deliveries',
  icon: 'Truck',
  perm: 'inventory.delivery.read',
  count: (ctx, id) =>
    countOf(ctx.tx.select({ value: count() }).from(deliveries)
      .where(and(eq(deliveries.companyId, ctx.companyId), eq(deliveries.partnerId, id)))),
  href: (locale, id) => `/${locale}/inventory/deliveries?f_partnerId=${id}`,
});
