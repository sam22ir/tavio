import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { getSaleOrder } from '@/modules/sales/service/orders';
import { PrintButton } from '@/modules/sales/ui/print-button';
import { companyIdentityOf, partnerIdentity } from '@/modules/invoicing/queries';
import { DocumentLayout } from '@/ui/print/document-layout';
import { documentLabels } from '@/ui/print/labels';

// Printable quotation / sales order on the shared legal layout. The browser prints it to PDF.
export default async function SaleOrderPrintPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const data = await withPageCtx(async (ctx) => {
    const result = await getSaleOrder(ctx, id);
    if (!result.ok) return null;
    const [company, buyer] = await Promise.all([
      companyIdentityOf(ctx),
      partnerIdentity(ctx, String(result.value.order.partnerId)),
    ]);
    if (!company || !buyer) return null;
    return { ...result.value, company, buyer };
  });
  if (!data) notFound();
  const { order, lines, company, buyer } = data;
  const t = await getTranslations('print');
  const isOrder = String(order.state ?? '') === 'confirmed';

  return (
    <>
      <DocumentLayout
        locale={locale as 'fr' | 'ar' | 'en'}
        labels={documentLabels((k) => t(k))}
        title={t(isOrder ? 'salesOrder' : 'quote')}
        number={order.number ? String(order.number) : ''}
        date={String(order.orderDate)}
        dueDate={order.validityDate ? String(order.validityDate) : null}
        company={company}
        party={buyer}
        partyRole="buyer"
        lines={lines.map((l) => ({
          description: String(l.description),
          quantity: String(l.quantity),
          unitPriceCents: BigInt(String(l.unitPriceCents ?? 0)),
          discountRate: String(l.discountRate ?? '0'),
          ratePercent: String(Number(l.taxRate ?? 0)),
          subtotalCents: BigInt(String(l.subtotalCents ?? 0)),
          taxCents: BigInt(String(l.taxCents ?? 0)),
        }))}
        totals={{
          untaxedCents: BigInt(String(order.untaxedCents ?? 0)),
          taxCents: BigInt(String(order.taxCents ?? 0)),
          totalCents: BigInt(String(order.totalCents ?? 0)),
        }}
      />
      <div className="no-print mx-auto max-w-[210mm] p-3">
        <PrintButton />
      </div>
    </>
  );
}
