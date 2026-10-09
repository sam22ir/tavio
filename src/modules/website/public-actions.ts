'use server';

import { placeWebOrder, type PlacedWebOrder } from './service/public';
import type { Result } from '@/core/result';

/** Checkout from the public storefront. Anonymous: no session, no tenant transaction. */
export async function placeWebOrderAction(raw: unknown): Promise<Result<PlacedWebOrder>> {
  try {
    return await placeWebOrder(raw);
  } catch (e) {
    // Log metadata only. Never the input (it holds the customer's phone and address).
    console.error('placeWebOrder failed', { name: e instanceof Error ? e.name : 'unknown' });
    return { ok: false, error: { code: 'INTERNAL', message: 'Internal error' } };
  }
}
