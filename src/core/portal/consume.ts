import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/core/db/client';
import { portalAccessTokens } from '@/core/db/schema/portal';
import type { Db } from '@/core/db/types';
import { withTenant } from '@/core/db/tenant';
import type { Locale } from '@/core/ctx';
import { err, ok, type Result } from '@/core/result';
import { partners } from '@/modules/contacts/schema';
import { PORTAL_ACTOR_ID, PORTAL_PERMS } from './context';
import { checkTokenState, parsePortalToken, hashPortalToken, type PortalPurpose, type PortalTarget } from './tokens';

export interface ConsumedLink {
  companyId: string;
  partnerId: string;
  tokenId: string;
  purpose: PortalPurpose;
  target: PortalTarget | null;
  expiresAt: Date;
}

/**
 * Resolves a link token into a portal session subject. Runs inside the token's own company (RLS applies).
 * Login links are marked used in the same statement that checks them, so a link works once even under races.
 */
export async function consumePortalToken(
  token: string,
  locale: Locale,
  now: Date = new Date(),
  db: Db = getDb(),
): Promise<Result<ConsumedLink>> {
  const parsed = parsePortalToken(token);
  if (!parsed) return err('NOT_FOUND', 'link not found');
  const tokenHash = hashPortalToken(token);

  return withTenant(
    { userId: PORTAL_ACTOR_ID, companyId: parsed.companyId, perms: PORTAL_PERMS, locale },
    async ({ tx }): Promise<Result<ConsumedLink>> => {
      const [row] = await tx
        .select()
        .from(portalAccessTokens)
        .where(and(eq(portalAccessTokens.companyId, parsed.companyId), eq(portalAccessTokens.tokenHash, tokenHash)))
        .for('update');
      if (!row) return err('NOT_FOUND', 'link not found');

      const state = checkTokenState({ purpose: row.purpose as PortalPurpose, expiresAt: row.expiresAt, usedAt: row.usedAt, revokedAt: row.revokedAt }, now);
      if (!state.ok) return err('FORBIDDEN', `link ${state.reason}`, { reason: state.reason });

      if (row.purpose === 'login') {
        const claimed = await tx
          .update(portalAccessTokens)
          .set({ usedAt: now })
          .where(and(eq(portalAccessTokens.id, row.id), isNull(portalAccessTokens.usedAt)))
          .returning({ id: portalAccessTokens.id });
        if (claimed.length === 0) return err('FORBIDDEN', 'link used', { reason: 'used' });
      }

      const [partner] = await tx
        .select({ id: partners.id })
        .from(partners)
        .where(and(eq(partners.companyId, parsed.companyId), eq(partners.id, row.partnerId), eq(partners.active, true)));
      if (!partner) return err('NOT_FOUND', 'link not found');

      const target: PortalTarget | null = row.targetEntity && row.targetId
        ? { entity: row.targetEntity as PortalTarget['entity'], id: row.targetId }
        : null;
      return ok({ companyId: parsed.companyId, partnerId: partner.id, tokenId: row.id, purpose: row.purpose as PortalPurpose, target, expiresAt: row.expiresAt });
    },
    db,
  );
}
