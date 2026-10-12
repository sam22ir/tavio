import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { parseListQuery } from '@/core/entities/list-query';
import { routing } from '@/i18n/routing';
import { webOrderEntity } from '@/modules/website/entities';
import { listWebOrders } from '@/modules/website/service/orders';
import { DataList } from '@/ui/views/data-list';

export default async function WebOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, webOrderEntity);
  const result = await withPageCtx((ctx) => listWebOrders(ctx, query));
  const t = await getTranslations('website');
  const currentLocale = await getLocale();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{t('orders.title')}</h1>
      {result.ok ? (
        <DataList
          entity={webOrderEntity}
          result={result.value}
          query={query}
          basePath={`/${currentLocale}/website/orders`}
          rowHref={(row) => `/${currentLocale}/website/orders/${row.id}`}
        />
      ) : (
        <p role="alert" className="text-sm text-destructive">{t('orders.error')}</p>
      )}
      <Link href={`/${currentLocale}/website`} className="text-sm text-muted hover:underline">
        ← {t('settings.title')}
      </Link>
    </div>
  );
}
