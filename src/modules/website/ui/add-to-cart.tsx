'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, buttonVariants } from '@/ui/primitives/button';
import { cn } from '@/ui/lib/cn';
import { MAX_CART_QTY, readCart, writeCart } from './cart-store';

export function AddToCart({ slug, productId, cartHref }: { slug: string; productId: string; cartHref: string }) {
  const t = useTranslations('website');
  const [added, setAdded] = useState(false);

  function add(): void {
    const items = readCart(slug);
    const existing = items.find((i) => i.productId === productId);
    if (existing) existing.quantity = Math.min(existing.quantity + 1, MAX_CART_QTY);
    else items.push({ productId, quantity: 1 });
    writeCart(slug, items);
    setAdded(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" onClick={add} className="min-h-11 w-full sm:w-auto">
        {t('shop.add_to_cart')}
      </Button>
      {added ? (
        <p role="status" className="flex flex-wrap items-center gap-3 text-sm">
          {t('shop.added')}
          <Link href={cartHref} className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11')}>
            {t('shop.view_cart')}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
