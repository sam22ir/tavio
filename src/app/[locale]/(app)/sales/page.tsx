import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { parseListQuery } from '@/core/entities/list-query';
import { saleOrderEntity } from '@/modules/sales/entities';
import { listSaleOrders } from '@/modules/sales/service/orders';
import { DataList } from '@/ui/views/data-list';
import { buttonVariants } from '@/ui/primitives/button';
import { cn } from '@/ui/lib/cn';

export default async function SalesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, saleOrderEntity);
  const t = await getTranslations('sales');
  const ioT = await getTranslations('io.import');
  const result = await withPageCtx((ctx) => listSaleOrders(ctx, query));
  if (!result.ok) throw new Error(result.error.code);

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">{t('title.list')}</h1>
      <DataList
        entity={saleOrderEntity}
        result={result.value}
        query={query}
        basePath={`/${locale}/sales`}
        rowHref={(r) => `/${locale}/sales/${r.id}`}
        actions={
          <>
            <Link href={`/${locale}/import/sales.quote`} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'min-h-11')}>
              {ioT('button')}
            </Link>
            <Link href={`/${locale}/sales/new`} className={cn(buttonVariants({ size: 'sm' }), 'min-h-11')}>
              {t('actions.new')}
            </Link>
          </>
        }
      />
    </div>
  );
}
