import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { listShopProducts, resolveShop } from '@/modules/website/service/public';
import { CartView } from '@/modules/website/ui/cart-view';
import { ShopHeader } from '@/modules/website/ui/shop-header';

export default async function ShopCartPage({
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
      <h1 className="text-xl font-semibold">{t('cart.title')}</h1>
      <CartView
        slug={slug}
        locale={currentLocale as 'fr' | 'ar' | 'en'}
        products={products}
        showPrices={resolved.shop.showPrices}
        whatsappNumber={resolved.shop.phoneWhatsapp}
        checkoutHref={`${base}/checkout`}
        shopHref={base}
      />
    </main>
  );
}
