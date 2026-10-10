import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { getOrder } from '@/modules/purchases/service/orders';
import { companyIdentityOf, partnerIdentity } from '@/modules/invoicing/queries';
import { DocumentLayout } from '@/ui/print/document-layout';
import { documentLabels } from '@/ui/print/labels';
import { PrintButton } from '@/ui/print/print-button';

// Printable purchase order. Company is the buyer; the supplier appears in the seller block.
export default async function PurchaseOrderPrintPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const data = await withPageCtx(async (ctx) => {
    const result = await getOrder(ctx, id);
    if (!result.ok) return null;
    const [company, supplier] = await Promise.all([
      companyIdentityOf(ctx),
      partnerIdentity(ctx, String(result.value.order.partnerId)),
    ]);
    if (!company || !supplier) return null;
    return { ...result.value, company, supplier };
  });
  if (!data) notFound();
  const { order, lines, company, supplier } = data;
  const t = await getTranslations('print');
  const money = (v: unknown) => BigInt(String(v ?? 0));

  return (
    <>
      <DocumentLayout
        locale={locale as 'fr' | 'ar' | 'en'}
        labels={documentLabels((k) => t(k))}
        title={t('purchaseOrder')}
        number={order.number ? String(order.number) : ''}
        date={String(order.orderDate)}
        company={company}
        party={supplier}
        partyRole="seller"
        lines={lines.map((l) => ({
          description: String(l.description),
          quantity: String(l.quantity),
          unitPriceCents: money(l.unitPriceCents),
          discountRate: '0',
          ratePercent: String(Number(l.taxRate ?? 0)),
          subtotalCents: money(l.subtotalCents),
          taxCents: money(l.taxCents),
        }))}
        totals={{
          untaxedCents: money(order.untaxedCents),
          taxCents: money(order.taxCents),
          totalCents: money(order.totalCents),
        }}
      />
      <div className="no-print mx-auto max-w-[210mm] p-3">
        <PrintButton />
      </div>
    </>
  );
}
