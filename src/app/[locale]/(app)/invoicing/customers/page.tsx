import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { listInvoices } from '@/modules/invoicing/queries';
import { InvoiceList } from '@/modules/invoicing/ui/views';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CustomersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { f_refundOfId } = await searchParams;
  const refundOfId = typeof f_refundOfId === 'string' && UUID.test(f_refundOfId) ? f_refundOfId : undefined;
  const rows = await withPageCtx((ctx) => listInvoices(ctx, 'customers', refundOfId));
  const t = await getTranslations('invoicing');
  const current = await getLocale();
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('list.customers')}</h1>
      <InvoiceList rows={rows} kind="customers" locale={current} t={(k) => t(k as never)} newHref={`/${current}/invoicing/customers/new`} />
    </div>
  );
}
