import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { listInvoices } from '@/modules/invoicing/queries';
import { InvoiceList } from '@/modules/invoicing/ui/views';

export default async function VendorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const rows = await withPageCtx((ctx) => listInvoices(ctx, 'vendors'));
  const t = await getTranslations('invoicing');
  const current = await getLocale();
  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('list.vendors')}</h1>
      <InvoiceList rows={rows} kind="vendors" locale={current} t={(k) => t(k as never)} newHref={`/${current}/invoicing/vendors/new`} />
    </main>
  );
}
