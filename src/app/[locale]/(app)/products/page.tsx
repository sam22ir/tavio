import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { parseListQuery } from '@/core/entities/list-query';
import { productEntity } from '@/modules/products/entities';
import { listProducts } from '@/modules/products/service/products';
import { DataList } from '@/ui/views/data-list';
import { buttonVariants } from '@/ui/primitives/button';
import { cn } from '@/ui/lib/cn';

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const ioT = await getTranslations('io.import');

  const query = parseListQuery(await searchParams, productEntity);
  const t = await getTranslations('products');
  const result = await withPageCtx((ctx) => listProducts(ctx, query));
  if (!result.ok) throw new Error(result.error.code);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t('product.title')}</h1>
      <DataList
        entity={productEntity}
        result={result.value}
        query={query}
        basePath={`/${locale}/products`}
        rowHref={(r) => `/${locale}/products/${r.id}`}
        actions={
          <>
            <Link href={`/${locale}/import/products.product`} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
              {ioT('button')}
            </Link>
            <Link href={`/${locale}/products/new`} className={cn(buttonVariants({ size: 'sm' }))}>
              {t('product.new')}
            </Link>
          </>
        }
      />
    </div>
  );
}
