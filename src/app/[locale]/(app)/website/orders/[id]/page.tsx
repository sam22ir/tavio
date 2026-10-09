import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { formatDzd } from '@/core/money';
import { routing } from '@/i18n/routing';
import { cancelWebOrderForm, convertWebOrderForm } from '@/modules/website/actions';
import { getWebOrder } from '@/modules/website/service/orders';
import { Chatter } from '@/modules/chatter/ui/chatter';
import { Button } from '@/ui/primitives/button';

type Locale = 'fr' | 'ar' | 'en';

export default async function WebOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('website');
  const currentLocale = (await getLocale()) as Locale;
  const result = await withPageCtx((ctx) => getWebOrder(ctx, id));
  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return (
      <main className="flex flex-col gap-6">
        <p role="alert" className="text-sm text-destructive">{t('orders.error')}</p>
      </main>
    );
  }
  const order = result.value;
  const isNew = order.state === 'new';

  return (
    <main className="flex flex-col gap-6">
      <Link href={`/${currentLocale}/website/orders`} className="text-sm text-muted-foreground hover:underline">
        ← {t('orders.title')}
      </Link>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold break-words">{order.number}</h1>
          <span className="text-sm text-muted-foreground">{t(`options.state.${order.state}`)}</span>
        </div>
        {isNew ? (
          <div className="flex flex-wrap gap-3">
            <form action={convertWebOrderForm}>
              <input type="hidden" name="id" value={id} />
              <Button type="submit" className="min-h-11">{t('orders.convert')}</Button>
            </form>
            <form action={cancelWebOrderForm}>
              <input type="hidden" name="id" value={id} />
              <Button type="submit" variant="outline" className="min-h-11">{t('orders.cancel')}</Button>
            </form>
          </div>
        ) : null}
      </header>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-md border p-4 sm:grid-cols-2">
        <Item label={t('fields.customerName')} value={order.customerName} />
        <Item label={t('fields.phone')} value={order.phone} />
        <Item label={t('fields.wilayaCode')} value={order.wilayaCode} />
        <Item label={t('fields.address')} value={order.address} />
      </dl>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[360px] text-sm">
          <thead className="bg-muted text-start">
            <tr>
              <th className="p-2 text-start">{t('orders.line.product')}</th>
              <th className="p-2 text-end">{t('orders.line.quantity')}</th>
              <th className="p-2 text-end">{t('orders.line.subtotal')}</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.productId} className="border-t">
                <td className="p-2 break-words">{line.name}</td>
                <td className="p-2 text-end tabular-nums">{line.quantity}</td>
                <td className="p-2 text-end tabular-nums">{formatDzd(BigInt(line.subtotalCents), currentLocale)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td className="p-2" colSpan={2}>{t('fields.totalCents')}</td>
              <td className="p-2 text-end tabular-nums">{formatDzd(BigInt(order.totalCents), currentLocale)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <section aria-labelledby="order-activity" className="flex flex-col gap-3">
        <h2 id="order-activity" className="text-base font-semibold">{t('orders.activity')}</h2>
        <Chatter entity="website.web_order" recordId={id} />
      </section>
    </main>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm">{value}</dd>
    </div>
  );
}
