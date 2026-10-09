import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { API_SCOPES, type ApiScope } from '../constants';

export const API_KEY_PREFIX = 'tav_';
export { API_SCOPES, type ApiScope } from '../constants';

const TOKEN_PATTERN = /^tav_[A-Za-z0-9_-]{32,}$/;

export interface GeneratedApiKey {
  token: string;   // shown once
  prefix: string;  // first 12 characters, stored for display
  hash: string;    // hex sha-256 of token, stored
}

export function hashApiKey(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** New token: `tav_` plus 32 random bytes in base64url. */
export function generateApiKey(): GeneratedApiKey {
  const token = `${API_KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
  return { token, prefix: token.slice(0, 12), hash: hashApiKey(token) };
}

/** Constant-time comparison of a presented token against a stored hex hash. */
export function verifyApiKey(token: string, storedHash: string): boolean {
  if (!TOKEN_PATTERN.test(token)) return false;
  const a = Buffer.from(hashApiKey(token), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Extracts the token from an `Authorization: Bearer tav_…` header, or null. */
export function parseBearer(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match?.[1]) return null;
  return TOKEN_PATTERN.test(match[1]) ? match[1] : null;
}

export function hasScope(scopes: readonly string[], required: ApiScope): boolean {
  return scopes.includes(required);
}

export function isApiScope(value: string): value is ApiScope {
  return (API_SCOPES as readonly string[]).includes(value);
}
