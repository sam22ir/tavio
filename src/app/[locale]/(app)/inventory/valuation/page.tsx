import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { stockValuation } from '@/modules/inventory/service/valuation-report';
import { listWarehouses } from '@/modules/inventory/service/warehouses';
import { formatDzd } from '@/core/money';

export default async function ValuationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ warehouse?: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!hasLocale(routing.locales, rawLocale)) notFound();
  const locale = rawLocale === 'ar' || rawLocale === 'en' ? rawLocale : 'fr';
  setRequestLocale(rawLocale);
  const t = await getTranslations('inventory');
  const { warehouse } = await searchParams;
  const warehouseId = warehouse && /^[0-9a-f-]{36}$/i.test(warehouse) ? warehouse : undefined;
  const [report, warehouses] = await Promise.all([
    withPageCtx((ctx) => stockValuation(ctx, { warehouseId })),
    withPageCtx((ctx) => listWarehouses(ctx)),
  ]);

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t('valuation.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('valuation.help')}</p>
      </div>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>{t('fields.warehouse')}</span>
          <select name="warehouse" defaultValue={warehouseId ?? ''} className="min-h-11 rounded-md border bg-background px-3">
            <option value="">{t('valuation.all_warehouses')}</option>
            {warehouses.ok &&
              warehouses.value.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
          </select>
        </label>
        <button type="submit" className="min-h-11 rounded-md border px-4 text-sm">
          {t('valuation.filter')}
        </button>
      </form>
      {report.ok ? (
        report.value.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('common.empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-start font-medium">{t('fields.product')}</th>
                  <th className="p-3 text-end font-medium">{t('fields.on_hand')}</th>
                  <th className="p-3 text-end font-medium">{t('valuation.avg_cost')}</th>
                  <th className="p-3 text-end font-medium">{t('valuation.value')}</th>
                </tr>
              </thead>
              <tbody>
                {report.value.rows.map((row) => (
                  <tr key={row.productId} className="border-t">
                    <td className="p-3 break-words">{row.productName}</td>
                    <td className="p-3 text-end tabular-nums">{row.onHand}</td>
                    <td className="p-3 text-end tabular-nums">{formatDzd(BigInt(row.avgCostCents), locale)}</td>
                    <td className="p-3 text-end tabular-nums">{formatDzd(BigInt(row.valueCents), locale)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/50 font-semibold">
                <tr>
                  <td className="p-3" colSpan={3}>{t('valuation.total')}</td>
                  <td className="p-3 text-end tabular-nums">{formatDzd(BigInt(report.value.totalCents), locale)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      ) : (
        <p role="alert" className="text-sm text-destructive">{t('common.error')}</p>
      )}
    </main>
  );
}
