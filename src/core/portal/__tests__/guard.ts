import { verifyPortalSession, type PortalSession } from '../session';

// Pure form of requirePortalSession: a missing or bad cookie yields null, which the page turns into a redirect.
export function resolvePortalSessionForTest(value: string | undefined, secret: string, now: Date): PortalSession | null {
  return verifyPortalSession(value, secret, now);
}
