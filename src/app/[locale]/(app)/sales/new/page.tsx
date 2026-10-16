import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { saleLookups } from '@/modules/sales/service/orders';
import { OrderForm } from '@/modules/sales/ui/order-form';
import { emptyOrderForm } from '@/modules/sales/ui/order-form-defaults';
import { todayAlgiers } from '../_lib';

export default async function NewSaleOrderPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('sales');
  const lookups = await withPageCtx((ctx) => saleLookups(ctx));
  if (!lookups.ok) throw new Error(lookups.error.code);
  const today = todayAlgiers();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title.new')}</h1>
      <OrderForm lookups={lookups.value} initial={emptyOrderForm(today)} today={today} locale={locale} />
    </div>
  );
}
