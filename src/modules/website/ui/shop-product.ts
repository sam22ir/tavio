import type { ShopProduct } from '../service/public';

/** Product name in the active locale, falling back to the French or base name. */
export function productName(product: Pick<ShopProduct, 'name' | 'nameAr'>, locale: string): string {
  if (locale === 'ar' && product.nameAr) return product.nameAr;
  return product.name;
}
