import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { readPortalSecret } from './env';
import { PORTAL_COOKIE, SESSION_TTL_MS, portalCookiePath, verifyPortalSession, type PortalSession } from './session';

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

/** The verified portal session for the request, or null. Never throws on a bad cookie. */
export async function currentPortalSession(): Promise<PortalSession | null> {
  const secret = readPortalSecret();
  if (!secret) return null;
  const store = await cookies();
  return verifyPortalSession(store.get(PORTAL_COOKIE)?.value, secret);
}

/** For portal pages: redirects to the portal login when there is no valid session. */
export async function requirePortalSession(locale: string): Promise<PortalSession> {
  const session = await currentPortalSession();
  if (!session) redirect(`/${locale}/portal/login`);
  return session;
}
