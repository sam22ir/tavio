import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { loadInvoice } from '@/modules/invoicing/service/invoices';
import { buildInvoicePrintHtml, type PrintLabels } from '@/modules/invoicing/service/print';
import { partnerIdentity, sellerOf } from '@/modules/invoicing/queries';

export default async function InvoicePrintPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const html = await withPageCtx(async (ctx) => {
    const loaded = await loadInvoice(ctx, id);
    if (!loaded.ok || loaded.value.invoice.state !== 'posted') return null;
    const { invoice, lines } = loaded.value;
    const [seller, buyer] = await Promise.all([sellerOf(ctx), partnerIdentity(ctx, invoice.partnerId)]);
    if (!seller || !buyer) return null;
    const t = await getTranslations('invoicing');
    const labels = Object.fromEntries(
      ['title', 'seller', 'buyer', 'nif', 'nis', 'rc', 'ai', 'address', 'number', 'date', 'description', 'qty', 'unit', 'discount', 'amount', 'vatRate', 'vat', 'stampDuty', 'totalInWords', 'print'].map(
        (k) => [k, t(`print.${k}`)],
      ),
    ) as unknown as PrintLabels;
    const rateOf = (r: string) => String(Number(r));
    return buildInvoicePrintHtml({
      locale: locale as 'fr' | 'ar' | 'en',
      dir: locale === 'ar' ? 'rtl' : 'ltr',
      labels,
      documentTitle: labels.title,
      number: invoice.number ?? '',
      date: String(invoice.date),
      seller,
      buyer,
      lines: lines.map((l) => ({
        description: l.description,
        quantity: String(l.quantity),
        unitPriceCents: l.unitPriceCents,
        discountRate: String(l.discountRate),
        subtotalCents: l.subtotalCents,
        ratePercent: rateOf(String(l.taxRate)),
      })),
      taxGroups: Object.values(
        lines.reduce<Record<string, { ratePercent: string; taxCents: bigint }>>((acc, l) => {
          const key = rateOf(String(l.taxRate));
          const g = acc[key] ?? { ratePercent: key, taxCents: BigInt(0) };
          g.taxCents += l.taxCents;
          acc[key] = g;
          return acc;
        }, {}),
      ),
      untaxedCents: invoice.untaxedCents,
      taxCents: invoice.taxCents,
      stampCents: invoice.stampCents,
      totalCents: invoice.totalCents,
    });
  });
  if (!html) notFound();
  // Server-built HTML: every value is escaped by buildInvoicePrintHtml.
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
