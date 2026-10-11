import type { Ctx, Locale } from '@/core/ctx';
import { withTenant } from '@/core/db/tenant';
import type { Db } from '@/core/db/types';
import { getDb } from '@/core/db/client';

// The portal has no staff user. The nil uuid is the actor for reads. Permissions are the two read
// permissions the portal pages need, and every query also filters by partner id.
export const PORTAL_ACTOR_ID = '00000000-0000-0000-0000-000000000000';
export const PORTAL_PERMS: ReadonlySet<string> = new Set(['invoicing.invoice.read', 'credit_sales.contract.read']);

export interface PortalScope {
  ctx: Ctx;
  companyId: string;
  partnerId: string;
}

/**
 * Runs fn in one tenant transaction for the session's company. The partner id comes only from the
 * verified session, never from a URL. Every portal query must filter by scope.partnerId.
 */
export async function portalCtx<T>(
  session: { companyId: string; partnerId: string },
  locale: Locale,
  fn: (scope: PortalScope) => Promise<T>,
  db: Db = getDb(),
): Promise<T> {
  return withTenant(
    { userId: PORTAL_ACTOR_ID, companyId: session.companyId, perms: PORTAL_PERMS, locale },
    (ctx) => fn({ ctx, companyId: session.companyId, partnerId: session.partnerId }),
    db,
  );
}
