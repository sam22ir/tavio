import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { loadInvoice } from '@/modules/invoicing/service/invoices';
import { partnerIdentity, companyIdentityOf } from '@/modules/invoicing/queries';
import { DocumentLayout } from '@/ui/print/document-layout';
import { documentLabels } from '@/ui/print/labels';

export default async function InvoicePrintPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const data = await withPageCtx(async (ctx) => {
    const loaded = await loadInvoice(ctx, id);
    if (!loaded.ok || loaded.value.invoice.state !== 'posted') return null;
    const { invoice, lines } = loaded.value;
    const [company, buyer] = await Promise.all([companyIdentityOf(ctx), partnerIdentity(ctx, invoice.partnerId)]);
    if (!company || !buyer) return null;
    return { invoice, lines, company, buyer };
  });
  if (!data) notFound();
  const { invoice, lines, company, buyer } = data;
  const t = await getTranslations('print');
  const isCredit = invoice.type === 'out_refund' || invoice.type === 'in_refund';
  return (
    <DocumentLayout
      locale={locale as 'fr' | 'ar' | 'en'}
      labels={documentLabels((k) => t(k))}
      title={t(isCredit ? 'creditNote' : 'invoice')}
      number={invoice.number ?? ''}
      date={String(invoice.date)}
      dueDate={invoice.dueDate ? String(invoice.dueDate) : null}
      company={company}
      party={buyer}
      partyRole="buyer"
      lines={lines.map((l) => ({
        description: l.description,
        quantity: String(l.quantity),
        unitPriceCents: l.unitPriceCents,
        discountRate: String(l.discountRate),
        ratePercent: String(Number(l.taxRate)),
        subtotalCents: l.subtotalCents,
        taxCents: l.taxCents,
      }))}
      totals={{
        untaxedCents: invoice.untaxedCents,
        taxCents: invoice.taxCents,
        stampCents: invoice.stampCents,
        totalCents: invoice.totalCents,
        paidCents: invoice.paidCents,
      }}
    />
  );
}
