import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { createAdjustmentForm } from '@/modules/inventory/actions';
import { goodsOptions } from '@/modules/inventory/service/options';
import { listLocations } from '@/modules/inventory/service/warehouses';
import { ActionForm } from '@/modules/inventory/ui/action-form';
import { buttonVariants } from '@/ui/primitives/button';
import { cn } from '@/ui/lib/cn';

export default async function AdjustmentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('inventory');
  const ioT = await getTranslations('io.import');
  const products = await withPageCtx((ctx) => goodsOptions(ctx));
  const locations = await withPageCtx((ctx) => listLocations(ctx));

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t('adjustments.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('adjustments.intro')}</p>
        <Link href={`/${locale}/import/inventory.opening_stock`} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'w-fit')}>
          {ioT('button')}
        </Link>
      </div>
      {products.ok && locations.ok ? (
        <ActionForm
          action={createAdjustmentForm}
          submitLabel={t('common.submit')}
          fields={[
            { name: 'productId', label: t('fields.product'), type: 'select', required: true, options: products.value },
            {
              name: 'locationId',
              label: t('fields.location'),
              type: 'select',
              required: true,
              options: locations.value
                .filter((l) => l.type === 'internal')
                .map((l) => ({ value: l.id, label: l.name })),
            },
            { name: 'countedQty', label: t('fields.counted'), required: true },
          ]}
        />
      ) : (
        <p role="alert" className="text-sm text-destructive">{t('common.error')}</p>
      )}
    </div>
  );
}
