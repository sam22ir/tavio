import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { loadInvoice } from '@/modules/invoicing/service/invoices';
import { paymentsOf, partnerNameOf } from '@/modules/invoicing/queries';
import { InvoiceDetail } from '@/modules/invoicing/ui/views';
import { InvoiceOriginLink } from '@/modules/invoicing/ui/origin-link';
import { RelatedLinks } from '@/ui/views/related-links';
import { PortalShareButton } from '@/core/portal/ui/portal-share-button';
import { SendMessageButton } from '@/core/messaging/ui/send-message-button';

export default async function CustomerInvoicePage({
  params, searchParams,
}: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { error } = await searchParams;
  const data = await withPageCtx(async (ctx) => {
    const loaded = await loadInvoice(ctx, id);
    if (!loaded.ok) return null;
    const [payments, partnerName] = await Promise.all([paymentsOf(ctx, id), partnerNameOf(ctx, loaded.value.invoice.partnerId)]);
    return { ...loaded.value, payments, partnerName };
  });
  if (!data) notFound();
  const t = await getTranslations('invoicing');
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <RelatedLinks source="invoicing.invoice" id={id} />
      {data.invoice.state === 'posted' ? (
        <div className="flex flex-wrap gap-2">
          <PortalShareButton mode="document" kind="invoice" id={id} />
          <SendMessageButton entity="invoicing.invoice" recordId={id} partnerId={data.invoice.partnerId} templateKey="invoice_sent" />
          <SendMessageButton entity="invoicing.invoice" recordId={id} partnerId={data.invoice.partnerId} templateKey="portal_invite" invite />
        </div>
      ) : null}
      <InvoiceOriginLink locale={locale} sourceEntity={data.invoice.sourceEntity} sourceId={data.invoice.sourceId} />
      <InvoiceDetail
        invoice={data.invoice} lines={data.lines} payments={data.payments} kind="customers" locale={locale}
        t={(k) => t(k as never)} error={error} partnerName={data.partnerName}
      />
    </div>
  );
}
