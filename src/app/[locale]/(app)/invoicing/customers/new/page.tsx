import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { partnerOptionsFor, taxOptionsFor } from '@/modules/invoicing/queries';
import { InvoiceNewForm } from '@/modules/invoicing/ui/views';

export default async function NewCustomerInvoice({
  params, searchParams,
}: { params: Promise<{ locale: string }>; searchParams: Promise<{ error?: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { error } = await searchParams;
  const [partners, taxes] = await withPageCtx((ctx) => Promise.all([partnerOptionsFor(ctx, 'customers'), taxOptionsFor(ctx, 'customers')]));
  const t = await getTranslations('invoicing');
  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('list.new')}</h1>
      <InvoiceNewForm kind="customers" locale={locale} t={(k) => t(k as never)} partners={partners} taxes={taxes} error={error} />
    </main>
  );
}
