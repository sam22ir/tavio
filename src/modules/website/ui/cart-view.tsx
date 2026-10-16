'use client';

import Link from 'next/link';
import { useMemo, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { formatDzd } from '@/core/money';
import { Button, buttonVariants } from '@/ui/primitives/button';
import { cn } from '@/ui/lib/cn';
import type { ShopProduct } from '../service/public';
import { MAX_CART_QTY, noopSubscribe, parseCart, readCartRaw, subscribeCart, writeCart, type CartItem } from './cart-store';
import { productName } from './shop-product';

interface CartViewProps {
  slug: string;
  locale: 'fr' | 'ar' | 'en';
  products: ShopProduct[];
  showPrices: boolean;
  whatsappNumber: string | null;
  checkoutHref: string;
  shopHref: string;
}

export function CartView({ slug, locale, products, showPrices, whatsappNumber, checkoutHref, shopHref }: CartViewProps) {
  const t = useTranslations('website');
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const raw = useSyncExternalStore(subscribeCart, () => readCartRaw(slug), () => '');
  const items = useMemo(() => parseCart(raw), [raw]);

  function update(next: CartItem[]): void {
    writeCart(slug, next);
  }

  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = items
    .map((item) => ({ item, product: byId.get(item.productId) }))
    .filter((l): l is { item: CartItem; product: ShopProduct } => l.product !== undefined);
  const total = lines.reduce((sum, l) => sum + BigInt(l.product.salePriceCents) * BigInt(l.item.quantity), BigInt(0));

  if (!ready) return null;
  if (lines.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t('cart.empty')}</p>
        <Link href={shopHref} className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11 w-fit')}>
          {t('cart.continue_shopping')}
        </Link>
      </div>
    );
  }

  const whatsappText = [
    t('cart.whatsapp_intro'),
    ...lines.map((l) => `${productName(l.product, locale)} x${l.item.quantity}`),
  ].join('\n');
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/^\+/, '')}?text=${encodeURIComponent(whatsappText)}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col divide-y rounded-2xl border border-separator">
        {lines.map(({ item, product }) => (
          <li key={item.productId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col">
              <span className="break-words font-medium">{productName(product, locale)}</span>
              {showPrices ? (
                <span className="text-sm text-muted">
                  {formatDzd(BigInt(product.salePriceCents), locale)}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 min-w-11"
                aria-label={t('cart.decrease')}
                disabled={item.quantity <= 1}
                onClick={() => update(items.map((i) => (i.productId === item.productId ? { ...i, quantity: i.quantity - 1 } : i)))}
              >
                −
              </Button>
              <span className="min-w-8 text-center tabular-nums">{item.quantity}</span>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 min-w-11"
                aria-label={t('cart.increase')}
                disabled={item.quantity >= MAX_CART_QTY}
                onClick={() => update(items.map((i) => (i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i)))}
              >
                +
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                onClick={() => update(items.filter((i) => i.productId !== item.productId))}
              >
                {t('cart.remove')}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {showPrices ? (
        <p className="text-base font-semibold">
          {t('cart.total')}: {formatDzd(total, locale)}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href={checkoutHref} className={cn(buttonVariants(), 'min-h-11')}>
          {t('cart.checkout')}
        </Link>
        {whatsappHref ? (
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11')}>
            {t('cart.order_whatsapp')}
          </a>
        ) : null}
      </div>
    </div>
  );
}
