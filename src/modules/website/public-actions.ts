'use server';

import { placeWebOrder, type PlacedWebOrder } from './service/public';
import { submitWebsiteContact } from './service/contact';
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

/** Contact form on the public storefront. Anonymous, rate-limited per phone, honeypot protected. */
export async function submitWebsiteContactAction(raw: unknown): Promise<Result<{ leadId: string | null }>> {
  try {
    return await submitWebsiteContact(raw);
  } catch (e) {
    console.error('submitWebsiteContact failed', { name: e instanceof Error ? e.name : 'unknown' });
    return { ok: false, error: { code: 'INTERNAL', message: 'Internal error' } };
  }
}
