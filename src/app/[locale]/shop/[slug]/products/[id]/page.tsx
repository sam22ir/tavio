import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { formatDzd } from '@/core/money';
import { routing } from '@/i18n/routing';
import { getShopProduct, resolveShop } from '@/modules/website/service/public';
import { AddToCart } from '@/modules/website/ui/add-to-cart';
import { productName } from '@/modules/website/ui/shop-product';
import { ShopHeader } from '@/modules/website/ui/shop-header';

export default async function ShopProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; id: string }>;
}) {
  const { locale, slug, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const resolved = await resolveShop(slug);
  if (!resolved) notFound();
  const product = await getShopProduct(resolved.companyId, id);
  if (!product) notFound();

  const t = await getTranslations('website');
  const currentLocale = await getLocale();
  const base = `/${currentLocale}/shop/${slug}`;

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <ShopHeader shop={resolved.shop} locale={currentLocale} />
      <Link href={base} className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:underline">
        ← {t('shop.products')}
      </Link>
      <article className="flex max-w-2xl flex-col gap-4">
        <h1 className="break-words text-xl font-semibold">{productName(product, currentLocale)}</h1>
        {resolved.shop.showPrices ? (
          <p className="text-base font-semibold">
            {formatDzd(BigInt(product.salePriceCents), currentLocale as 'fr' | 'ar' | 'en')}
          </p>
        ) : null}
        {product.description ? <p className="whitespace-pre-line text-sm">{product.description}</p> : null}
        <AddToCart slug={slug} productId={product.id} cartHref={`${base}/cart`} />
      </article>
    </main>
  );
}
