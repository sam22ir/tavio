import { describe, expect, it } from 'vitest';
import { PORTAL_COOKIE, derivePortalKey, signPortalSession, verifyPortalSession, portalCookiePath } from '../session';
import { normalizeIdentifier, loginKeyHash } from '../login';
import { resolvePortalSessionForTest } from './guard';

const SECRET = 'test-secret-that-is-long-enough-0123456789';
const OTHER = 'another-secret-value-for-tests-9876543210';
const COMPANY = '3f1c2b7a-8d4e-4f5a-9b6c-7d8e9f0a1b2c';
const PARTNER = '7a9e0b1c-2d3e-4f50-8a61-b72c83d94e05';
const NOW = new Date('2026-10-11T10:00:00Z');
const TOKEN = '5c2d1e0f-3a4b-4c5d-8e6f-7a8b9c0d1e2f';
const session = { companyId: COMPANY, partnerId: PARTNER, tokenId: TOKEN, scope: null, exp: NOW.getTime() + 7 * 24 * 60 * 60 * 1000 };

describe('portal session cookie', () => {
  it('round-trips a signed session', () => {
    const value = signPortalSession(session, SECRET);
    expect(verifyPortalSession(value, SECRET, NOW)).toEqual(session);
  });

  it('refuses a tampered payload', () => {
    const [payload, signature] = signPortalSession(session, SECRET).split('.') as [string, string];
    const forged = Buffer.from(JSON.stringify({ v: 1, companyId: COMPANY, partnerId: '00000000-0000-4000-8000-000000000001', tokenId: TOKEN, scope: null, exp: session.exp }), 'utf8').toString('base64url');
    expect(payload).not.toBe(forged);
    expect(verifyPortalSession(`${forged}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it('refuses a tampered signature', () => {
    const [payload, signature] = signPortalSession(session, SECRET).split('.') as [string, string];
    const flipped = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
    expect(verifyPortalSession(`${payload}.${flipped}`, SECRET, NOW)).toBeNull();
    expect(verifyPortalSession(`${payload}.`, SECRET, NOW)).toBeNull();
  });

  it('refuses a session signed with another secret', () => {
    expect(verifyPortalSession(signPortalSession(session, OTHER), SECRET, NOW)).toBeNull();
  });

  it('refuses expired, malformed and missing values', () => {
    const expired = signPortalSession({ ...session, exp: NOW.getTime() - 1 }, SECRET);
    expect(verifyPortalSession(expired, SECRET, NOW)).toBeNull();
    expect(verifyPortalSession(undefined, SECRET, NOW)).toBeNull();
    expect(verifyPortalSession('', SECRET, NOW)).toBeNull();
    expect(verifyPortalSession('a.b.c', SECRET, NOW)).toBeNull();
    expect(verifyPortalSession('garbage', SECRET, NOW)).toBeNull();
    expect(verifyPortalSession(signPortalSession(session, SECRET), '', NOW)).toBeNull();
  });

  it('derives a key that differs from the raw secret and per secret', () => {
    expect(derivePortalKey(SECRET).equals(derivePortalKey(OTHER))).toBe(false);
    expect(derivePortalKey(SECRET).toString('utf8')).not.toContain(SECRET);
  });

  it('is named apart from the staff cookie and scoped to the locale portal path', () => {
    expect(PORTAL_COOKIE).toBe('tavio_portal');
    expect(PORTAL_COOKIE).not.toBe('tavio_company');
    expect(portalCookiePath('ar')).toBe('/ar/portal');
  });

  it('returns null (the guard then redirects) when the cookie is absent', () => {
    expect(resolvePortalSessionForTest(undefined, SECRET, NOW)).toBeNull();
    expect(resolvePortalSessionForTest(signPortalSession(session, SECRET), SECRET, NOW)).toEqual(session);
  });
});

describe('login identifiers and rate-limit keys', () => {
  it('normalizes email to lower case and rejects garbage', () => {
    expect(normalizeIdentifier('  Ali@Example.DZ ')).toEqual({ kind: 'email', value: 'ali@example.dz' });
    expect(normalizeIdentifier('not an email@')).toBeNull();
    expect(normalizeIdentifier('   ')).toBeNull();
  });

  it('keys identifiers and IPs separately', () => {
    expect(loginKeyHash('id', 'x')).not.toBe(loginKeyHash('ip', 'x'));
    expect(loginKeyHash('ip', '1.2.3.4')).toMatch(/^[0-9a-f]{64}$/);
  });
});
