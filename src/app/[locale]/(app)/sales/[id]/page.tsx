import { RelatedLinks } from '@/ui/views/related-links';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { formatDzd } from '@/core/money';
import { getSaleOrder } from '@/modules/sales/service/orders';
import { OrderActions } from '@/modules/sales/ui/order-actions';
import { SendMessageButton } from '@/core/messaging/ui/send-message-button';
import { Chatter } from '@/modules/chatter/ui/chatter';

export default async function SaleOrderPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('sales');
  const result = await withPageCtx((ctx) => getSaleOrder(ctx, id));
  if (!result.ok) notFound();
  const { order, lines, partnerName } = result.value;
  const money = (v: unknown) => formatDzd(BigInt(String(v ?? '0')), locale as 'fr' | 'ar' | 'en');

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{order.number ? String(order.number) : t('title.new')}</h1>
      <RelatedLinks source="sales.order" id={id} />
        <p className="text-sm text-muted-foreground">
          {partnerName} · {t(`options.state.${String(order.state)}` as 'options.state.draft')}
        </p>
      </div>

      <OrderActions id={id} state={String(order.state)} invoiced={Boolean(order.invoiced)} locale={locale} />
      <div className="flex flex-wrap gap-2">
        <SendMessageButton entity="sales.order" recordId={id} partnerId={String(order.partnerId)} templateKey="quote_sent" />
        <SendMessageButton entity="sales.order" recordId={id} partnerId={String(order.partnerId)} templateKey="portal_invite" invite />
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">{t('fields.orderDate')}</dt>
          <dd>{String(order.orderDate)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('fields.validityDate')}</dt>
          <dd>{order.validityDate ? String(order.validityDate) : '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('fields.note')}</dt>
          <dd>{order.note ? String(order.note) : '—'}</dd>
        </div>
      </dl>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="bg-muted/50 text-start">
            <tr>
              <th className="p-2 text-start">{t('fields.description')}</th>
              <th className="p-2 text-end">{t('fields.quantity')}</th>
              <th className="p-2 text-end">{t('fields.unitPrice')}</th>
              <th className="p-2 text-end">{t('fields.discount')}</th>
              <th className="p-2 text-end">{t('fields.subtotal')}</th>
              <th className="p-2 text-end">{t('fields.tax')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={String(l.id)} className="border-t">
                <td className="p-2">{String(l.description)}</td>
                <td className="p-2 text-end">{String(l.quantity)}</td>
                <td className="p-2 text-end">{money(l.unitPriceCents)}</td>
                <td className="p-2 text-end">{String(Number(l.discountRate ?? 0))}%</td>
                <td className="p-2 text-end">{money(l.subtotalCents)}</td>
                <td className="p-2 text-end">{money(l.taxCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ms-auto grid w-full max-w-sm gap-1 text-sm">
        <div className="flex justify-between">
          <dt>{t('fields.untaxedCents')}</dt>
          <dd>{money(order.untaxedCents)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>{t('fields.taxCents')}</dt>
          <dd>{money(order.taxCents)}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt>{t('fields.totalCents')}</dt>
          <dd>{money(order.totalCents)}</dd>
        </div>
      </dl>

      <Chatter entity="sales.order" recordId={id} />
    </div>
  );
}
