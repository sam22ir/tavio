import { createHash, randomBytes } from 'node:crypto';

// Portal link tokens (W16-E). Format: `<companyId>.<random>`. Only the SHA-256 of the whole token is stored.
// Login links last 30 minutes and are single use. Document links last 30 days.

export const LOGIN_TTL_MS = 30 * 60 * 1000;
export const DOCUMENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type PortalPurpose = 'login' | 'document';
export type PortalTargetEntity = 'invoicing.invoice' | 'credit_sales.contract';
export interface PortalTarget { entity: PortalTargetEntity; id: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECRET_RE = /^[A-Za-z0-9_-]{40,}$/;

export function ttlMsFor(purpose: PortalPurpose): number {
  return purpose === 'login' ? LOGIN_TTL_MS : DOCUMENT_TTL_MS;
}

export function generatePortalToken(companyId: string): string {
  if (!UUID_RE.test(companyId)) throw new Error('companyId must be a UUID');
  return `${companyId}.${randomBytes(32).toString('base64url')}`;
}

/** Splits a token into its company id and secret part. Null when the shape is wrong. */
export function parsePortalToken(token: string): { companyId: string; secret: string } | null {
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const companyId = token.slice(0, dot);
  const secret = token.slice(dot + 1);
  if (!UUID_RE.test(companyId) || !SECRET_RE.test(secret)) return null;
  return { companyId: companyId.toLowerCase(), secret };
}

/** SHA-256 hex of the full token. */
export function hashPortalToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export interface TokenState {
  purpose: PortalPurpose;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt?: Date | null;
}

export type TokenCheck = { ok: true } | { ok: false; reason: 'expired' | 'used' | 'revoked' };

/** Pure check of a stored token row. Login links are refused once used or after expiry. */
export function checkTokenState(row: TokenState, now: Date = new Date()): TokenCheck {
  if (row.revokedAt) return { ok: false, reason: 'revoked' };
  if (row.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: 'expired' };
  if (row.purpose === 'login' && row.usedAt !== null) return { ok: false, reason: 'used' };
  return { ok: true };
}

/** Builds the absolute URL for a token. The base URL must have no trailing slash. */
export function portalTokenUrl(baseUrl: string, locale: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${locale}/portal/t/${token}`;
}

/** Path of the portal page a target opens. */
export function portalTargetPath(target: PortalTarget): string {
  return target.entity === 'invoicing.invoice'
    ? `/portal/invoices/${target.id}`
    : `/portal/contracts/${target.id}`;
}
