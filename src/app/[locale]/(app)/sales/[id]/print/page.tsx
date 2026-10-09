import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { formatDzd } from '@/core/money';
import { getSaleOrder } from '@/modules/sales/service/orders';
import { PrintButton } from '@/modules/sales/ui/print-button';

// Printable quotation. Plain HTML with print styles; the browser prints it to PDF.
export default async function SaleOrderPrintPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('sales');
  const result = await withPageCtx((ctx) => getSaleOrder(ctx, id));
  if (!result.ok) notFound();
  const { order, lines, partnerName } = result.value;
  const money = (v: unknown) => formatDzd(BigInt(String(v ?? '0')), locale as 'fr' | 'ar' | 'en');

  return (
    <article className="mx-auto max-w-3xl bg-white p-6 text-sm text-black print:p-0">
      <header className="flex flex-wrap justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-lg font-semibold">{t('title.print')}</h1>
          <p>{order.number ? String(order.number) : '—'}</p>
        </div>
        <div className="text-end">
          <p>
            {t('print.date')}: {String(order.orderDate)}
          </p>
          {order.validityDate ? (
            <p>
              {t('print.validUntil')}: {String(order.validityDate)}
            </p>
          ) : null}
        </div>
      </header>

      <section className="py-4">
        <p className="font-medium">{partnerName}</p>
      </section>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem]">
          <thead>
            <tr className="border-b text-start">
              <th className="py-2 text-start">{t('print.description')}</th>
              <th className="py-2 text-end">{t('print.quantity')}</th>
              <th className="py-2 text-end">{t('print.unitPrice')}</th>
              <th className="py-2 text-end">{t('print.total')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={String(l.id)} className="border-b">
                <td className="py-2">{String(l.description)}</td>
                <td className="py-2 text-end">{String(l.quantity)}</td>
                <td className="py-2 text-end">{money(l.unitPriceCents)}</td>
                <td className="py-2 text-end">{money(l.subtotalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ms-auto mt-4 grid max-w-xs gap-1">
        <div className="flex justify-between">
          <dt>{t('print.untaxed')}</dt>
          <dd>{money(order.untaxedCents)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>{t('print.vat')}</dt>
          <dd>{money(order.taxCents)}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt>{t('print.grandTotal')}</dt>
          <dd>{money(order.totalCents)}</dd>
        </div>
      </dl>

      <footer className="mt-8 text-xs text-neutral-600">
        <p>{t('print.footer')}</p>
        <div className="mt-4">
          <PrintButton />
        </div>
      </footer>
    </article>
  );
}
