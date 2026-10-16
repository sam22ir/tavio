import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { getSaleOrder, saleLookups } from '@/modules/sales/service/orders';
import { OrderForm } from '@/modules/sales/ui/order-form';
import { toDraftLines, todayAlgiers } from '../../_lib';

export default async function EditSaleOrderPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('sales');
  const data = await withPageCtx(async (ctx) => {
    const detail = await getSaleOrder(ctx, id);
    const lookups = await saleLookups(ctx);
    if (!lookups.ok) throw new Error(lookups.error.code);
    return { detail, lookups: lookups.value };
  });
  if (!data.detail.ok) notFound();
  const { order, lines } = data.detail.value;
  if (order.state !== 'draft' && order.state !== 'sent') notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title.edit')}</h1>
      <OrderForm
        lookups={data.lookups}
        today={todayAlgiers()}
        locale={locale}
        initial={{
          id,
          partnerId: String(order.partnerId),
          orderDate: String(order.orderDate),
          validityDate: order.validityDate ? String(order.validityDate) : '',
          note: order.note ? String(order.note) : '',
          lines: toDraftLines(lines as never[], id),
        }}
      />
    </div>
  );
}
