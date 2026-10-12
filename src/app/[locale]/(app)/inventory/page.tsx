import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { stockLevels } from '@/modules/inventory/service/stock';

export default async function StockPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('inventory');
  const result = await withPageCtx((ctx) => stockLevels(ctx));

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t('stock.title')}</h1>
        <p className="text-sm text-muted">{t('stock.help')}</p>
      </div>
      {result.ok ? (
        result.value.length === 0 ? (
          <p className="text-sm text-muted">{t('common.empty')}</p>
        ) : (
          <section className="app-panel flex flex-col gap-4 p-5">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-default/50 text-start">
                    <tr>
                      <th className="p-3 text-start font-medium">{t('fields.product')}</th>
                      <th className="p-3 text-end font-medium">{t('fields.on_hand')}</th>
                      <th className="p-3 text-end font-medium">{t('fields.reserved')}</th>
                      <th className="p-3 text-end font-medium">{t('fields.available')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.value.map((row) => (
                      <tr key={row.productId} className="border-t">
                        <td className="p-3 break-words">{row.productName}</td>
                        <td className="p-3 text-end tabular-nums">{row.onHand}</td>
                        <td className="p-3 text-end tabular-nums">{row.reserved}</td>
                        <td className="p-3 text-end tabular-nums">{row.available}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </section>
        )
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {t('common.error')}
        </p>
      )}
    </div>
  );
}
