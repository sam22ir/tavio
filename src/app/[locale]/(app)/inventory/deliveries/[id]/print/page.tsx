import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { getDelivery } from '@/modules/inventory/service/deliveries';
import { companyIdentityOf, partnerIdentity } from '@/modules/invoicing/queries';
import { DeliveryNoteLayout } from '@/ui/print/delivery-note-layout';
import { documentLabels } from '@/ui/print/labels';
import { PrintButton } from '@/ui/print/print-button';
import { toMilliText, remainingOf } from '@/modules/inventory/service/delivery-view';

// Printable delivery note (bon de livraison). No prices. The browser prints it to PDF.
export default async function DeliveryNotePrintPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const data = await withPageCtx(async (ctx) => {
    const result = await getDelivery(ctx, id);
    if (!result.ok) return null;
    const [company, customer] = await Promise.all([
      companyIdentityOf(ctx),
      partnerIdentity(ctx, result.value.partnerId),
    ]);
    if (!company || !customer) return null;
    return { delivery: result.value, company, customer };
  });
  if (!data) notFound();
  const { delivery, company, customer } = data;
  const t = await getTranslations('print');
  const date = (delivery.deliveredAt ?? delivery.scheduledDate ?? '').slice(0, 10);

  return (
    <>
      <DeliveryNoteLayout
        locale={locale as 'fr' | 'ar' | 'en'}
        labels={documentLabels((k) => t(k))}
        extra={{
          qtyOrdered: t('qtyOrdered'),
          qtyDelivered: t('qtyDelivered'),
          qtyRemaining: t('qtyRemaining'),
          deliveryAddress: t('deliveryAddress'),
          originBackorder: t('originBackorder'),
          signatureDeliverer: t('signatureDeliverer'),
          signatureReceiver: t('signatureReceiver'),
        }}
        title={t('deliveryNote')}
        number={delivery.number}
        date={date}
        company={company}
        customer={customer}
        originNumber={delivery.originNumber}
        lines={delivery.lines.map((l) => ({
          description: l.productName,
          ordered: toMilliText(l.quantity),
          delivered: toMilliText(l.deliveredQty),
          remaining: remainingOf(l.quantity, l.deliveredQty),
        }))}
      />
      <div className="no-print mx-auto max-w-[210mm] p-3">
        <PrintButton />
      </div>
    </>
  );
}
