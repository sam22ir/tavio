import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_TTL_MS, LOGIN_TTL_MS, checkTokenState, generatePortalToken, hashPortalToken,
  parsePortalToken, portalTargetPath, portalTokenUrl, ttlMsFor,
} from '../tokens';

const COMPANY = '3f1c2b7a-8d4e-4f5a-9b6c-7d8e9f0a1b2c';

describe('portal tokens', () => {
  it('generates a token prefixed by the company id and parses back', () => {
    const token = generatePortalToken(COMPANY);
    expect(token.startsWith(`${COMPANY}.`)).toBe(true);
    const parsed = parsePortalToken(token);
    expect(parsed?.companyId).toBe(COMPANY);
    expect(parsed?.secret.length).toBeGreaterThanOrEqual(40);
  });

  it('generates distinct tokens', () => {
    expect(generatePortalToken(COMPANY)).not.toBe(generatePortalToken(COMPANY));
  });

  it('refuses malformed tokens', () => {
    expect(parsePortalToken('')).toBeNull();
    expect(parsePortalToken('no-dot-here')).toBeNull();
    expect(parsePortalToken(`not-a-uuid.${'a'.repeat(43)}`)).toBeNull();
    expect(parsePortalToken(`${COMPANY}.short`)).toBeNull();
    expect(parsePortalToken(`${COMPANY}.${'a'.repeat(40)}!`)).toBeNull();
  });

  it('hashes with sha-256 hex and never equals the token', () => {
    const token = generatePortalToken(COMPANY);
    const hash = hashPortalToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashPortalToken(token)).toBe(hash);
    expect(hashPortalToken(`${token}x`)).not.toBe(hash);
  });

  it('uses 30 minutes for login links and 30 days for document links', () => {
    expect(ttlMsFor('login')).toBe(LOGIN_TTL_MS);
    expect(LOGIN_TTL_MS).toBe(30 * 60 * 1000);
    expect(ttlMsFor('document')).toBe(DOCUMENT_TTL_MS);
    expect(DOCUMENT_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('refuses an expired login link', () => {
    const now = new Date('2026-10-11T10:00:00Z');
    const result = checkTokenState({ purpose: 'login', expiresAt: new Date('2026-10-11T09:59:59Z'), usedAt: null }, now);
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('refuses a used login link even before it expires', () => {
    const now = new Date('2026-10-11T10:00:00Z');
    const result = checkTokenState({ purpose: 'login', expiresAt: new Date('2026-10-11T10:20:00Z'), usedAt: new Date('2026-10-11T09:55:00Z') }, now);
    expect(result).toEqual({ ok: false, reason: 'used' });
  });

  it('accepts a fresh login link and a document link that is not expired', () => {
    const now = new Date('2026-10-11T10:00:00Z');
    expect(checkTokenState({ purpose: 'login', expiresAt: new Date('2026-10-11T10:30:00Z'), usedAt: null }, now)).toEqual({ ok: true });
    expect(checkTokenState({ purpose: 'document', expiresAt: new Date('2026-11-01T00:00:00Z'), usedAt: null }, now)).toEqual({ ok: true });
  });

  it('does not treat a document link as used-once', () => {
    const now = new Date('2026-10-11T10:00:00Z');
    expect(checkTokenState({ purpose: 'document', expiresAt: new Date('2026-11-01T00:00:00Z'), usedAt: new Date() }, now)).toEqual({ ok: true });
  });

  it('builds absolute locale-prefixed URLs and target paths', () => {
    expect(portalTokenUrl('https://app.example.dz/', 'ar', 'abc')).toBe('https://app.example.dz/ar/portal/t/abc');
    expect(portalTargetPath({ entity: 'invoicing.invoice', id: COMPANY })).toBe(`/portal/invoices/${COMPANY}`);
    expect(portalTargetPath({ entity: 'credit_sales.contract', id: COMPANY })).toBe(`/portal/contracts/${COMPANY}`);
  });
});
