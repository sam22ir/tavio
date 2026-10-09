import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ShopPublic } from '../service/public';

// Server component: storefront header. Uses only the public, safe shop fields.
export async function ShopHeader({ shop, locale }: { shop: ShopPublic; locale: string }) {
  const t = await getTranslations('website');
  const home = `/${locale}/shop/${shop.slug}`;
  return (
    <header className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col">
        <Link href={home} className="break-words text-lg font-semibold">
          {shop.title}
        </Link>
        <span className="text-sm text-muted-foreground">{shop.companyName}</span>
      </div>
      <nav className="flex gap-4 text-sm">
        <Link href={home} className="inline-flex min-h-11 items-center hover:underline">
          {t('shop.home')}
        </Link>
        <Link href={`${home}/cart`} className="inline-flex min-h-11 items-center hover:underline">
          {t('shop.cart')}
        </Link>
      </nav>
    </header>
  );
}
