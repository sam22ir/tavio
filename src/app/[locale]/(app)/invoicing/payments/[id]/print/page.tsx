import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { companyIdentityOf, paymentReceiptOf, partnerIdentity } from '@/modules/invoicing/queries';
import { PaymentReceipt } from '@/ui/print/payment-receipt';
import { documentLabels } from '@/ui/print/labels';
import { PrintButton } from '@/ui/print/print-button';

// Payment receipt (reçu de paiement) for one invoice payment.
export default async function PaymentReceiptPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const data = await withPageCtx(async (ctx) => {
    const receipt = await paymentReceiptOf(ctx, id);
    if (!receipt) return null;
    const [company, payer] = await Promise.all([companyIdentityOf(ctx), partnerIdentity(ctx, String(receipt.invoice.partnerId))]);
    if (!company || !payer) return null;
    return { ...receipt, company, payer };
  });
  if (!data) notFound();
  const { payment, invoice, company, payer, paidToDateCents } = data;
  const t = await getTranslations('print');
  const tInv = await getTranslations('invoicing');
  const methodLabel = t(`methods.${payment.method}`);

  return (
    <>
      <PaymentReceipt
        locale={locale as 'fr' | 'ar' | 'en'}
        labels={documentLabels((k) => t(k))}
        labelsExtra={{
          invoice: t('invoice'),
          payer: t('payer'),
          method: t('method'),
          amountPaid: t('amountPaid'),
          remaining: t('remaining'),
          receiptWords: t('receiptWords'),
          reference: t('reference'),
          paymentDate: t('paymentDate'),
        }}
        receiptTitle={t('receiptTitle')}
        receiptNumber={payment.reference ?? payment.id.slice(0, 8).toUpperCase()}
        paymentDate={String(payment.date)}
        methodLabel={methodLabel}
        reference={payment.reference}
        invoiceNumber={invoice.number ?? ''}
        invoiceDate={String(invoice.date)}
        company={company}
        payer={payer}
        amountCents={BigInt(String(payment.amountCents))}
        invoiceTotalCents={BigInt(String(invoice.totalCents))}
        paidToDateCents={paidToDateCents}
      />
      <div className="no-print mx-auto max-w-[210mm] p-3">
        <PrintButton label={tInv('detail.print')} />
      </div>
    </>
  );
}
