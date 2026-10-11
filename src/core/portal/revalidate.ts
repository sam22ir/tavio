import { and, eq } from 'drizzle-orm';
import { getDb } from '@/core/db/client';
import { portalAccessTokens } from '@/core/db/schema/portal';
import type { Db } from '@/core/db/types';
import { withTenant } from '@/core/db/tenant';
import { PORTAL_ACTOR_ID, PORTAL_PERMS } from './context';
import type { PortalSession } from './session';

/**
 * True while the session's token row still exists for this partner, is not revoked, and (for a document link)
 * has not expired. Login-link sessions are not ended by the link's 30-minute window, only by revocation.
 * Fails closed: any error counts as inactive.
 */
export async function portalSessionIsActive(session: PortalSession, now: Date = new Date(), db: Db = getDb()): Promise<boolean> {
  try {
    return await withTenant(
      { userId: PORTAL_ACTOR_ID, companyId: session.companyId, perms: PORTAL_PERMS, locale: 'fr' },
      async ({ tx }) => {
        const [row] = await tx
          .select({ purpose: portalAccessTokens.purpose, expiresAt: portalAccessTokens.expiresAt, revokedAt: portalAccessTokens.revokedAt })
          .from(portalAccessTokens)
          .where(and(
            eq(portalAccessTokens.companyId, session.companyId),
            eq(portalAccessTokens.id, session.tokenId),
            eq(portalAccessTokens.partnerId, session.partnerId),
          ));
        if (!row || row.revokedAt) return false;
        if (row.purpose === 'document' && row.expiresAt.getTime() <= now.getTime()) return false;
        return true;
      },
      db,
    );
  } catch {
    return false;
  }
}
