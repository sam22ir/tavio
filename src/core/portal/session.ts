import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

// Portal session (W16-E). Stateless, signed with an HMAC key derived from BETTER_AUTH_SECRET.
// Separate from the staff better-auth session and from the staff cookie `tavio_company`.

export const PORTAL_COOKIE = 'tavio_portal';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const KEY_CONTEXT = 'tavio-portal-session:v1';

export interface PortalSession {
  companyId: string;
  partnerId: string;
  /** Expiry as epoch milliseconds. */
  exp: number;
}

const PayloadSchema = z.object({
  v: z.literal(1),
  companyId: z.uuid(),
  partnerId: z.uuid(),
  exp: z.number().int().positive(),
});

/** Cookie path for one locale: the portal cookie is scoped to /{locale}/portal. */
export function portalCookiePath(locale: string): string {
  return `/${locale}/portal`;
}

/** HMAC-SHA256 key derived from the app secret. Never used directly for anything else. */
export function derivePortalKey(secret: string): Buffer {
  return createHmac('sha256', secret).update(KEY_CONTEXT).digest();
}

function mac(key: Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

export function signPortalSession(session: PortalSession, secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({ v: 1, companyId: session.companyId, partnerId: session.partnerId, exp: session.exp }),
    'utf8',
  ).toString('base64url');
  const signature = mac(derivePortalKey(secret), payload).toString('base64url');
  return `${payload}.${signature}`;
}

/** Returns the session, or null when the value is missing, tampered with, signed by another secret, malformed or expired. */
export function verifyPortalSession(
  value: string | undefined,
  secret: string,
  now: Date = new Date(),
): PortalSession | null {
  if (!value || !secret) return null;
  const parts = value.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts as [string, string];
  const expected = mac(derivePortalKey(secret), payload);
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const result = PayloadSchema.safeParse(parsed);
  if (!result.success) return null;
  if (result.data.exp <= now.getTime()) return null;
  return { companyId: result.data.companyId, partnerId: result.data.partnerId, exp: result.data.exp };
}
