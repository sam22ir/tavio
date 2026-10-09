import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { createMoveForm } from '@/modules/inventory/actions';
import { goodsOptions } from '@/modules/inventory/service/options';
import { listLocations } from '@/modules/inventory/service/warehouses';
import { ActionForm } from '@/modules/inventory/ui/action-form';

export default async function NewMovePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('inventory');
  const currentLocale = await getLocale();
  const products = await withPageCtx((ctx) => goodsOptions(ctx));
  const locations = await withPageCtx((ctx) => listLocations(ctx));

  const locationOptions = locations.ok
    ? locations.value.map((l) => ({ value: l.id, label: l.name }))
    : [];

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <Link href={`/${currentLocale}/inventory/moves`} className="text-sm text-muted-foreground hover:underline">
        ← {t('moves.title')}
      </Link>
      <h1 className="text-xl font-semibold">{t('moves.new')}</h1>
      {products.ok && locations.ok ? (
        <ActionForm
          action={createMoveForm}
          submitLabel={t('common.submit')}
          fields={[
            { name: 'productId', label: t('fields.product'), type: 'select', required: true, options: products.value },
            { name: 'quantity', label: t('fields.quantity'), required: true },
            { name: 'fromLocationId', label: t('fields.from'), type: 'select', required: true, options: locationOptions },
            { name: 'toLocationId', label: t('fields.to'), type: 'select', required: true, options: locationOptions },
            { name: 'reference', label: t('fields.reference'), hint: t('moves.reference_hint') },
          ]}
        />
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {t('common.error')}
        </p>
      )}
    </main>
  );
}
