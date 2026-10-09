import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { formatDzd } from '@/core/money';
import { routing } from '@/i18n/routing';
import { listShopProducts, resolveShop } from '@/modules/website/service/public';
import { productName } from '@/modules/website/ui/shop-product';
import { ShopHeader } from '@/modules/website/ui/shop-header';

export default async function ShopHomePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const resolved = await resolveShop(slug);
  if (!resolved) notFound();
  const products = await listShopProducts(resolved.companyId);
  const t = await getTranslations('website');
  const currentLocale = await getLocale();
  const base = `/${currentLocale}/shop/${slug}`;

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <ShopHeader shop={resolved.shop} locale={currentLocale} />
      {resolved.shop.about ? <p className="max-w-2xl whitespace-pre-line text-sm">{resolved.shop.about}</p> : null}
      <h1 className="text-base font-semibold">{t('shop.products')}</h1>
      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('shop.no_products')}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`${base}/products/${p.id}`} className="flex h-full min-h-11 flex-col gap-2 rounded-md border p-4 hover:bg-muted">
                <span className="break-words font-medium">{productName(p, currentLocale)}</span>
                {resolved.shop.showPrices ? (
                  <span className="text-sm text-muted-foreground">
                    {formatDzd(BigInt(p.salePriceCents), currentLocale as 'fr' | 'ar' | 'en')}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
