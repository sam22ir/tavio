import { describe, expect, it } from 'vitest';
import { checkTokenState } from '../tokens';
import { isFullSession, sessionMayOpen, signPortalSession, verifyPortalSession, type PortalSession } from '../session';

const SECRET = 'test-secret-that-is-long-enough-0123456789';
const COMPANY = '3f1c2b7a-8d4e-4f5a-9b6c-7d8e9f0a1b2c';
const PARTNER = '7a9e0b1c-2d3e-4f50-8a61-b72c83d94e05';
const TOKEN = '5c2d1e0f-3a4b-4c5d-8e6f-7a8b9c0d1e2f';
const INVOICE_A = '11111111-1111-4111-8111-111111111111';
const INVOICE_B = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-10-11T10:00:00Z');
const EXP = NOW.getTime() + 30 * 24 * 60 * 60 * 1000;

const full: PortalSession = { companyId: COMPANY, partnerId: PARTNER, tokenId: TOKEN, scope: null, exp: EXP };
const scoped: PortalSession = {
  ...full,
  scope: { entity: 'invoicing.invoice', id: INVOICE_A },
};

describe('scoped document sessions', () => {
  it('keeps the document scope inside the signed cookie', () => {
    const round = verifyPortalSession(signPortalSession(scoped, SECRET), SECRET, NOW);
    expect(round).toEqual(scoped);
    expect(isFullSession(round as PortalSession)).toBe(false);
  });

  it('rejects a scope widened by hand', () => {
    const [payload, sig] = signPortalSession(scoped, SECRET).split('.') as [string, string];
    const widened = Buffer.from(JSON.stringify({ v: 1, companyId: COMPANY, partnerId: PARTNER, tokenId: TOKEN, scope: null, exp: EXP }), 'utf8').toString('base64url');
    expect(payload).not.toBe(widened);
    expect(verifyPortalSession(`${widened}.${sig}`, SECRET, NOW)).toBeNull();
  });

  it('opens only its own document, not another invoice of the same partner', () => {
    expect(sessionMayOpen(scoped, 'invoicing.invoice', INVOICE_A)).toBe(true);
    expect(sessionMayOpen(scoped, 'invoicing.invoice', INVOICE_B)).toBe(false);
    expect(sessionMayOpen(scoped, 'credit_sales.contract', INVOICE_A)).toBe(false);
    expect(sessionMayOpen(scoped, 'invoicing.invoice', INVOICE_A.toUpperCase())).toBe(true);
  });

  it('is not a full session, so the lists and home page refuse it', () => {
    expect(isFullSession(scoped)).toBe(false);
  });

  it('a login-link session keeps the whole account', () => {
    expect(isFullSession(full)).toBe(true);
    expect(sessionMayOpen(full, 'invoicing.invoice', INVOICE_B)).toBe(true);
  });
});

describe('revoked links', () => {
  it('refuses a revoked document link even before it expires', () => {
    const result = checkTokenState(
      { purpose: 'document', expiresAt: new Date('2026-11-01T00:00:00Z'), usedAt: null, revokedAt: new Date('2026-10-10T00:00:00Z') },
      NOW,
    );
    expect(result).toEqual({ ok: false, reason: 'revoked' });
  });

  it('refuses a revoked login link', () => {
    const result = checkTokenState(
      { purpose: 'login', expiresAt: new Date('2026-10-11T10:20:00Z'), usedAt: null, revokedAt: NOW },
      NOW,
    );
    expect(result).toEqual({ ok: false, reason: 'revoked' });
  });

  it('still accepts an unrevoked, unexpired document link', () => {
    expect(checkTokenState({ purpose: 'document', expiresAt: new Date('2026-11-01T00:00:00Z'), usedAt: null, revokedAt: null }, NOW)).toEqual({ ok: true });
  });
});
