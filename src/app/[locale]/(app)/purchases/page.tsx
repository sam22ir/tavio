import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { parseListQuery } from '@/core/entities/list-query';
import { routing } from '@/i18n/routing';
import { purchaseOrderEntity } from '@/modules/purchases/entities';
import { listOrders } from '@/modules/purchases/service/orders';
import { buttonVariants } from '@/ui/primitives/button';
import { DataList } from '@/ui/views/data-list';
import { cn } from '@/ui/lib/cn';

export default async function PurchaseOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, purchaseOrderEntity);
  const result = await withPageCtx((ctx) => listOrders(ctx, query));
  const t = await getTranslations('purchases');
  const currentLocale = await getLocale();

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('order.title')}</h1>
      {result.ok ? (
        <DataList
          entity={purchaseOrderEntity}
          result={result.value}
          query={query}
          basePath={`/${currentLocale}/purchases`}
          rowHref={(row) => `/${currentLocale}/purchases/${row.id}`}
          actions={
            <Link href={`/${currentLocale}/purchases/new`} className={cn(buttonVariants())}>
              {t('order.new')}
            </Link>
          }
        />
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {t('errors.internal')}
        </p>
      )}
    </div>
  );
}
