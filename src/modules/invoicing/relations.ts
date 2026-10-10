// Smart buttons on an invoice detail page. Side-effect file: imported by modules/relation-handlers.
import { and, count, eq } from 'drizzle-orm';
import { relations, type RelationDef } from '@/core/relations';
import { invoicePayments, invoices } from './schema';

async function countOf(query: Promise<{ value: number }[]>): Promise<number> {
  const [row] = await query;
  return row?.value ?? 0;
}

// Payments are listed on the invoice page itself, so this links to its payments section.
relations.register({
  id: 'invoicing.invoice->invoicing.payment',
  source: 'invoicing.invoice',
  labelKey: 'relations.invoice.payments',
  icon: 'CreditCard',
  perm: 'invoicing.invoice.read',
  count: (ctx, id) =>
    countOf(ctx.tx.select({ value: count() }).from(invoicePayments)
      .where(and(eq(invoicePayments.companyId, ctx.companyId), eq(invoicePayments.invoiceId, id)))),
  href: () => '#payments',
});

// Refunds are listed on the customer or vendor invoice list, so each side has its own relation.
// The count only applies when the source invoice has that side's type, so only one relation shows a count.
function refundRelation(side: 'customers' | 'vendors', sourceType: 'out_invoice' | 'in_invoice'): RelationDef {
  return {
    id: `invoicing.invoice->invoicing.refund.${side}`,
    source: 'invoicing.invoice',
    labelKey: 'relations.invoice.refunds',
    icon: 'Receipt',
    perm: 'invoicing.invoice.read',
    count: async (ctx, id) => {
      const [source] = await ctx.tx
        .select({ type: invoices.type })
        .from(invoices)
        .where(and(eq(invoices.companyId, ctx.companyId), eq(invoices.id, id)));
      if (source?.type !== sourceType) return 0;
      return countOf(ctx.tx.select({ value: count() }).from(invoices)
        .where(and(eq(invoices.companyId, ctx.companyId), eq(invoices.refundOfId, id))));
    },
    href: (locale, id) => `/${locale}/invoicing/${side}?f_refundOfId=${id}`,
  };
}

relations.register(refundRelation('customers', 'out_invoice'));
relations.register(refundRelation('vendors', 'in_invoice'));
