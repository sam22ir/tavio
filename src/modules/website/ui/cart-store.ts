// Client-side cart in localStorage, one key per storefront. Reads and writes never throw.
// Components subscribe with useSyncExternalStore, so every open tab and component stays in step.
export interface CartItem { productId: string; quantity: number }

export const MAX_CART_QTY = 99;

const keyFor = (slug: string): string => `tavio.cart.${slug}`;
const listeners = new Set<() => void>();

export function readCartRaw(slug: string): string {
  try {
    return window.localStorage.getItem(keyFor(slug)) ?? '';
  } catch {
    return '';
  }
}

export function parseCart(raw: string): CartItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const items: CartItem[] = [];
    for (const entry of parsed) {
      if (typeof entry !== 'object' || entry === null) continue;
      const { productId, quantity } = entry as { productId?: unknown; quantity?: unknown };
      if (
        typeof productId === 'string' &&
        typeof quantity === 'number' &&
        Number.isInteger(quantity) &&
        quantity >= 1 &&
        quantity <= MAX_CART_QTY
      ) {
        items.push({ productId, quantity });
      }
    }
    return items;
  } catch {
    return [];
  }
}

export function readCart(slug: string): CartItem[] {
  return parseCart(readCartRaw(slug));
}

export function writeCart(slug: string, items: CartItem[]): void {
  try {
    window.localStorage.setItem(keyFor(slug), JSON.stringify(items));
  } catch {
    // Storage can be blocked (private mode). The cart then lasts for this page only.
  }
  listeners.forEach((notify) => notify());
}

/** Subscribe for useSyncExternalStore. Notified by this tab's writes and by other tabs. */
export function subscribeCart(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener('storage', callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', callback);
  };
}

export const noopSubscribe = (): (() => void) => () => {};
