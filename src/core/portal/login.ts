import { and, eq, gt, or, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { sendEmail } from '@/core/adapters/email';
import type { Locale } from '@/core/ctx';
import { companies } from '@/core/db/schema/tenancy';
import { portalLoginRequests } from '@/core/db/schema/portal';
import { withTenant } from '@/core/db/tenant';
import { partners } from '@/modules/contacts/schema';
import { normalizePhone } from '@/modules/contacts/service/partners';
import { PORTAL_ACTOR_ID, PORTAL_PERMS } from './context';
import { portalLoginEmail } from './emails';
import { issuePortalToken } from './links';
import { portalTokenUrl } from './tokens';

// Rate limits: per identifier and per client IP, within a 15 minute window.
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_PER_IDENTIFIER = 5;
export const LOGIN_MAX_PER_IP = 20;

export interface PortalLoginRequest {
  companyId: string;
  identifier: string;
  ip: string | null;
  locale: Locale;
  baseUrl: string;
  now?: Date;
}

/** Lower-cased email, or E.164-like phone, or null when the input is neither. */
export function normalizeIdentifier(raw: string): { kind: 'email' | 'phone'; value: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes('@')) {
    const email = trimmed.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { kind: 'email', value: email } : null;
  }
  const phone = normalizePhone(trimmed);
  return phone ? { kind: 'phone', value: phone } : null;
}

export function loginKeyHash(scope: 'id' | 'ip', value: string): string {
  return createHash('sha256').update(`${scope}:${value}`, 'utf8').digest('hex');
}

/**
 * Handles a login request. Always resolves to nothing, so the caller shows the same message whether
 * or not an account matched. Sends a single-use login link by email when a partner matches.
 */
export async function requestPortalLogin(input: PortalLoginRequest): Promise<void> {
  const now = input.now ?? new Date();
  const id = normalizeIdentifier(input.identifier);
  try {
    await withTenant(
      { userId: PORTAL_ACTOR_ID, companyId: input.companyId, perms: PORTAL_PERMS, locale: input.locale },
      async ({ tx }) => {
        const since = new Date(now.getTime() - LOGIN_WINDOW_MS);
        const idKey = id ? loginKeyHash('id', `${id.kind}:${id.value}`) : loginKeyHash('id', `raw:${input.identifier.trim().toLowerCase()}`);
        const ipKey = loginKeyHash('ip', input.ip ?? 'unknown');

        const [counts] = await tx
          .select({
            byId: sql<number>`count(*) filter (where ${portalLoginRequests.keyHash} = ${idKey})::int`,
            byIp: sql<number>`count(*) filter (where ${portalLoginRequests.keyHash} = ${ipKey})::int`,
          })
          .from(portalLoginRequests)
          .where(and(
            eq(portalLoginRequests.companyId, input.companyId),
            gt(portalLoginRequests.createdAt, since),
            or(eq(portalLoginRequests.keyHash, idKey), eq(portalLoginRequests.keyHash, ipKey)),
          ));
        await tx.insert(portalLoginRequests).values([
          { companyId: input.companyId, keyHash: idKey },
          { companyId: input.companyId, keyHash: ipKey },
        ]);
        if (!id) return null;
        if ((counts?.byId ?? 0) >= LOGIN_MAX_PER_IDENTIFIER || (counts?.byIp ?? 0) >= LOGIN_MAX_PER_IP) return null;

        const matches = await tx
          .select({ id: partners.id, email: partners.email })
          .from(partners)
          .where(and(
            eq(partners.companyId, input.companyId),
            eq(partners.active, true),
            id.kind === 'email'
              ? sql`lower(${partners.email}) = ${id.value}`
              : or(eq(partners.phone, id.value), eq(partners.phoneAlt, id.value)),
          ))
          .limit(1);
        const match = matches[0];
        if (!match?.email) return null;

        const [company] = await tx.select({ name: companies.displayName }).from(companies).where(eq(companies.id, input.companyId));
        const issued = await issuePortalToken(tx, {
          companyId: input.companyId,
          partnerId: match.id,
          purpose: 'login',
          createdBy: null,
          now,
        });
        return { email: match.email, companyName: company?.name ?? '', url: portalTokenUrl(input.baseUrl, input.locale, issued.token) };
      },
    ).then(async (mail) => {
      if (!mail) return;
      const content = portalLoginEmail(input.locale, mail.companyName, mail.url);
      await sendEmail({ to: mail.email, subject: content.subject, html: content.html, text: content.text });
    });
  } catch {
    // Never reveal failures to the requester. Details are not logged with personal data.
    console.info('[portal] login request failed');
  }
}
