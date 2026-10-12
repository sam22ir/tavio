import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { createReorderRuleForm } from '@/modules/inventory/actions';
import { goodsOptions } from '@/modules/inventory/service/options';
import { lowStock } from '@/modules/inventory/service/stock';
import { listWarehouses } from '@/modules/inventory/service/warehouses';
import { ActionForm } from '@/modules/inventory/ui/action-form';

export default async function LowStockPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('inventory');
  const low = await withPageCtx((ctx) => lowStock(ctx));
  const products = await withPageCtx((ctx) => goodsOptions(ctx));
  const warehouses = await withPageCtx((ctx) => listWarehouses(ctx));

  return (
    <main className="flex flex-col gap-8 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('low_stock.title')}</h1>
      {low.ok ? (
        low.value.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('low_stock.empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-default/50">
                <tr>
                  <th className="p-3 text-start font-medium">{t('fields.product')}</th>
                  <th className="p-3 text-start font-medium">{t('fields.warehouse')}</th>
                  <th className="p-3 text-end font-medium">{t('fields.on_hand')}</th>
                  <th className="p-3 text-end font-medium">{t('fields.min_qty')}</th>
                  <th className="p-3 text-end font-medium">{t('fields.to_order')}</th>
                </tr>
              </thead>
              <tbody>
                {low.value.map((row) => (
                  <tr key={row.reorderRuleId} className="border-t">
                    <td className="p-3 break-words">{row.productName}</td>
                    <td className="p-3 break-words">{row.warehouseName}</td>
                    <td className="p-3 text-end tabular-nums">{row.onHand}</td>
                    <td className="p-3 text-end tabular-nums">{row.minQty}</td>
                    <td className="p-3 text-end tabular-nums">{row.toOrder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <p role="alert" className="text-sm text-destructive">{t('common.error')}</p>
      )}
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">{t('low_stock.new_rule')}</h2>
        {products.ok && warehouses.ok ? (
          <ActionForm
            action={createReorderRuleForm}
            submitLabel={t('common.submit')}
            fields={[
              { name: 'productId', label: t('fields.product'), type: 'select', required: true, options: products.value },
              {
                name: 'warehouseId',
                label: t('fields.warehouse'),
                type: 'select',
                required: true,
                options: warehouses.value.map((w) => ({ value: w.id, label: w.name })),
              },
              { name: 'minQty', label: t('fields.min_qty'), required: true },
              { name: 'maxQty', label: t('fields.max_qty') },
            ]}
          />
        ) : (
          <p role="alert" className="text-sm text-destructive">{t('common.error')}</p>
        )}
      </section>
    </main>
  );
}
