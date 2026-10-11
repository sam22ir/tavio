import Link from 'next/link';
import { RelatedLinks } from '@/ui/views/related-links';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { formatDzd } from '@/core/money';
import { getSaleOrder } from '@/modules/sales/service/orders';
import { DELIVERY_BADGE, INVOICE_BADGE } from '@/modules/sales/service/progress-view';
import { OrderActions } from '@/modules/sales/ui/order-actions';
import { Chatter } from '@/modules/chatter/ui/chatter';
import { toMilliText } from '@/modules/inventory/service/delivery-view';

const TONE: Record<'warn' | 'info' | 'ok', string> = {
  warn: 'bg-amber-100 text-amber-900',
  info: 'bg-sky-100 text-sky-900',
  ok: 'bg-emerald-100 text-emerald-900',
};

export default async function SaleOrderPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('sales');
  const result = await withPageCtx((ctx) => getSaleOrder(ctx, id));
  if (!result.ok) notFound();
  const { order, lines, partnerName, progress, deliveries, invoices } = result.value;
  const money = (v: unknown) => formatDzd(BigInt(String(v ?? '0')), locale as 'fr' | 'ar' | 'en');
  const confirmed = String(order.state) === 'confirmed' || String(order.state) === 'done';
  const deliveryBadge = DELIVERY_BADGE[progress.deliveryStatus];
  const invoiceBadge = INVOICE_BADGE[progress.invoiceStatus];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{order.number ? String(order.number) : t('title.new')}</h1>
      <RelatedLinks source="sales.order" id={id} />
        <p className="text-sm text-muted-foreground">
          {partnerName} · {t(`options.state.${String(order.state)}` as 'options.state.draft')}
        </p>
        {confirmed ? (
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span className={`rounded-full px-2 py-1 ${TONE[deliveryBadge.tone]}`}>{t(deliveryBadge.key as 'progress.delivery.to_deliver')}</span>
            <span className={`rounded-full px-2 py-1 ${TONE[invoiceBadge.tone]}`}>{t(invoiceBadge.key as 'progress.invoice.to_invoice')}</span>
          </div>
        ) : null}
      </div>

      <OrderActions id={id} state={String(order.state)} invoiced={progress.invoiceStatus === 'invoiced'} locale={locale} />

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
              <th className="p-2 text-end">{t('fields.deliveredQty')}</th>
              <th className="p-2 text-end">{t('fields.invoicedQty')}</th>
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
                <td className="p-2 text-end tabular-nums">{toMilliText(String(l.quantity))}</td>
                <td className="p-2 text-end tabular-nums">{toMilliText(String(l.deliveredQty))}</td>
                <td className="p-2 text-end tabular-nums">{toMilliText(String(l.invoicedQty))}</td>
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

      {confirmed ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{t('sections.deliveries')}</h2>
          {deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('sections.noDeliveries')}</p>
          ) : (
            <ul className="divide-y rounded-md border text-sm">
              {deliveries.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 p-2">
                  <Link href={`/${locale}/inventory/deliveries/${d.id}`} className="underline break-all">
                    {d.number}
                  </Link>
                  <span className="text-muted-foreground">{t(`deliveryState.${d.state}` as 'deliveryState.draft')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{t('sections.invoices')}</h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('sections.noInvoices')}</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-2 p-2">
                <Link href={`/${locale}/invoicing/customers/${inv.id}`} className="underline break-all">
                  {inv.number ?? inv.id.slice(0, 8)}
                </Link>
                <span className="tabular-nums text-muted-foreground">{money(inv.totalCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Chatter entity="sales.order" recordId={id} />
    </div>
  );
}
