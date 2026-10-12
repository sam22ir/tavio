// Pure storefront rules. No database access, so they run in unit tests.
import type { Cents } from '@/core/money';

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export { WILAYA_CODE_RE as WILAYA_RE } from '@/core/tenancy/wilayas';
const E164_RE = /^\+[1-9]\d{7,14}$/;

export const RATE_LIMIT_MAX_ORDERS = 5;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
export const MAX_LINES_PER_ORDER = 30;
export const MAX_QTY_PER_LINE = 99;

export function isValidSlug(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 60 && SLUG_RE.test(slug);
}

/** Normalises an Algerian mobile or landline to E.164. Accepts +213..., 00213..., and local 0XXXXXXXXX. */
export function normalizeWhatsappPhone(raw: string): string | null {
  const compact = raw.replace(/[\s.\-()]/g, '');
  let candidate = compact;
  if (compact.startsWith('00')) candidate = `+${compact.slice(2)}`;
  else if (/^0\d{8,9}$/.test(compact)) candidate = `+213${compact.slice(1)}`;
  return E164_RE.test(candidate) ? candidate : null;
}

/** True when the phone already placed RATE_LIMIT_MAX_ORDERS orders in the window. */
export function isRateLimited(ordersInWindow: number): boolean {
  return ordersInWindow >= RATE_LIMIT_MAX_ORDERS;
}

export type OrderStateAction = 'confirm' | 'cancel';
export type WebOrderState = 'new' | 'confirmed' | 'cancelled';

/** Only new orders move on. Confirmed and cancelled orders are final. */
export function nextOrderState(current: WebOrderState, action: OrderStateAction): WebOrderState | null {
  if (current !== 'new') return null;
  return action === 'confirm' ? 'confirmed' : 'cancelled';
}

/** Line subtotal from the server-side unit price. Quantity must be a positive integer. */
export function lineSubtotal(unitPriceCents: Cents, quantity: number): Cents {
  if (!Number.isInteger(quantity) || quantity < 1) throw new RangeError('quantity must be a positive integer');
  return unitPriceCents * BigInt(quantity);
}
