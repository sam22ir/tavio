import type { Result } from '@/core/result';
import { portalPaymentsEnabled } from './env';

// Extension point for online payment in the portal (W16-E). No provider is implemented yet.
// To add one: implement PortalPaymentProvider and return it from getPortalPaymentProvider().

export interface PortalCheckoutInput {
  companyId: string;
  partnerId: string;
  invoiceId?: string;
  contractId?: string;
  amountCents: bigint;
  /** Absolute URL to return to after payment. */
  returnUrl: string;
}

export interface PortalPaymentProvider {
  readonly name: string;
  createCheckout(input: PortalCheckoutInput): Promise<Result<{ url: string }>>;
}

/** No implementation yet. Returning a provider here is the only change needed to enable payment. */
export function getPortalPaymentProvider(): PortalPaymentProvider | null {
  return null;
}

/** The pay button is shown only when the flag is on and a provider exists. */
export function canPayOnline(): boolean {
  return portalPaymentsEnabled() && getPortalPaymentProvider() !== null;
}
