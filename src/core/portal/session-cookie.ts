import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { readPortalSecret } from './env';
import { PORTAL_COOKIE, SESSION_TTL_MS, isFullSession, portalCookiePath, sessionMayOpen, verifyPortalSession, type PortalSession } from './session';
import { portalSessionIsActive } from './revalidate';
import type { PortalTarget } from './tokens';

// Cookie IO for the portal. Staff routes never read PORTAL_COOKIE.

export function portalCookieOptions(locale: string, maxAgeSeconds: number): {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: portalCookiePath(locale),
    maxAge: maxAgeSeconds,
  };
}

export const PORTAL_SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;

/** The verified, still-active portal session for the request, or null. Never throws on a bad cookie. */
export async function currentPortalSession(): Promise<PortalSession | null> {
  const secret = readPortalSecret();
  if (!secret) return null;
  const store = await cookies();
  const session = verifyPortalSession(store.get(PORTAL_COOKIE)?.value, secret);
  if (!session) return null;
  return (await portalSessionIsActive(session)) ? session : null;
}

/** For portal pages: redirects to the portal login when there is no valid session. */
export async function requirePortalSession(locale: string): Promise<PortalSession> {
  const session = await currentPortalSession();
  if (!session) redirect(`/${locale}/portal/login`);
  return session;
}

/** For the account lists and the home page: a document-link session is sent to the login form instead. */
export async function requireFullPortalSession(locale: string): Promise<PortalSession> {
  const session = await requirePortalSession(locale);
  if (!isFullSession(session)) redirect(`/${locale}/portal/login?c=${session.companyId}&e=scoped`);
  return session;
}

/** For one document page: a document-link session may open only its own document. Other ids are not found. */
export async function requireDocumentPortalSession(
  locale: string,
  entity: PortalTarget['entity'],
  id: string,
): Promise<PortalSession> {
  const session = await requirePortalSession(locale);
  if (!sessionMayOpen(session, entity, id)) notFound();
  return session;
}
