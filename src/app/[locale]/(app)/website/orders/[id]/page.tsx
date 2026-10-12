import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { formatDzd } from '@/core/money';
import { routing } from '@/i18n/routing';
import { cancelWebOrderForm, convertWebOrderForm } from '@/modules/website/actions';
import { getLinkedSale, getWebOrder } from '@/modules/website/service/orders';
import { buttonVariants } from '@/ui/primitives/button';
import { cn } from '@/ui/lib/cn';
import { Chatter } from '@/modules/chatter/ui/chatter';
import { Button } from '@/ui/primitives/button';
import { ErrorToast } from '@/ui/feedback/error-toast';

type Locale = 'fr' | 'ar' | 'en';

export default async function WebOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale, id } = await params;
  const { error } = await searchParams;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('website');
  const currentLocale = (await getLocale()) as Locale;
  const result = await withPageCtx((ctx) => getWebOrder(ctx, id));
  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return (
      <div className="flex flex-col gap-6">
        <p role="alert" className="text-sm text-destructive">{t('orders.error')}</p>
      </div>
    );
  }
  const order = result.value;
  const isNew = order.state === 'new';
  const saleOrderId = order.saleOrderId;
  const linked = saleOrderId ? await withPageCtx((ctx) => getLinkedSale(ctx, saleOrderId)) : null;
  const sale = linked?.ok ? linked.value : null;

  return (
    <div className="flex flex-col gap-6">
      {error ? <ErrorToast message={t('orders.error')} /> : null}
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
          <thead className="bg-default text-start">
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

      <section aria-labelledby="order-sales" className="flex flex-col gap-3">
        <h2 id="order-sales" className="text-base font-semibold">{t('orders.linked.title')}</h2>
        {sale ? (
          <div className="flex flex-col gap-3 rounded-md border p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">{t('orders.linked.sale')}</span>
                <span className="break-words">{sale.number ?? t('orders.linked.draft')} · {t(`orders.linked.state.${sale.state}`)}</span>
              </div>
              <Link href={`/${currentLocale}/sales/${sale.id}`} className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11')}>
                {t('orders.linked.open_sale')}
              </Link>
            </div>
            {sale.invoices.length === 0 ? (
              <p className="text-muted-foreground">{t('orders.linked.no_invoice')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sale.invoices.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 border-t pt-2">
                    <span className="break-words">
                      {t('orders.linked.invoice')} {inv.number ?? '—'} · {formatDzd(BigInt(inv.paidCents), currentLocale)} / {formatDzd(BigInt(inv.totalCents), currentLocale)} · {t(`orders.linked.payment.${inv.paymentState}`)}
                    </span>
                    <Link href={`/${currentLocale}/invoicing/customers/${inv.id}`} className="inline-flex min-h-11 items-center hover:underline">
                      {t('orders.linked.open_invoice')}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('orders.linked.none')}</p>
        )}
      </section>

      <section aria-labelledby="order-activity" className="flex flex-col gap-3">
        <h2 id="order-activity" className="text-base font-semibold">{t('orders.activity')}</h2>
        <Chatter entity="website.web_order" recordId={id} />
      </section>
    </div>
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
