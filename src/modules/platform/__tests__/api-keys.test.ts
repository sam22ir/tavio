import { describe, expect, it } from 'vitest';
import {
  generateApiKey,
  hasScope,
  hashApiKey,
  isApiScope,
  parseBearer,
  verifyApiKey,
} from '../service/api-keys-crypto';

describe('api key hashing and verification', () => {
  it('generates a tav_ token whose stored hash matches its sha-256', () => {
    const key = generateApiKey();
    expect(key.token.startsWith('tav_')).toBe(true);
    expect(key.token.length).toBeGreaterThanOrEqual(40);
    expect(key.prefix).toBe(key.token.slice(0, 12));
    expect(key.hash).toBe(hashApiKey(key.token));
    expect(key.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('never repeats a token', () => {
    expect(generateApiKey().token).not.toBe(generateApiKey().token);
  });

  it('verifies the right token and rejects others', () => {
    const key = generateApiKey();
    const other = generateApiKey();
    expect(verifyApiKey(key.token, key.hash)).toBe(true);
    expect(verifyApiKey(other.token, key.hash)).toBe(false);
  });

  it('rejects malformed tokens even when the hash would match', () => {
    const key = generateApiKey();
    expect(verifyApiKey('tav_short', hashApiKey('tav_short'))).toBe(false);
    expect(verifyApiKey(key.token + ' ', key.hash)).toBe(false);
  });

  it('rejects a stored hash of the wrong length without throwing', () => {
    const key = generateApiKey();
    expect(verifyApiKey(key.token, 'abcd')).toBe(false);
  });
});

describe('parseBearer', () => {
  const token = `tav_${'a'.repeat(43)}`;

  it('extracts the token from a Bearer header', () => {
    expect(parseBearer(`Bearer ${token}`)).toBe(token);
    expect(parseBearer(`bearer ${token}`)).toBe(token);
  });

  it.each([
    [null],
    [''],
    ['Basic abc'],
    ['Bearer'],
    ['Bearer not_a_tavio_key'],
    [`Bearer ${token} extra`],
  ])('returns null for %s', (header) => {
    expect(parseBearer(header)).toBeNull();
  });
});

describe('scopes', () => {
  it('checks required scope membership', () => {
    expect(hasScope(['contacts:read', 'products:write'], 'products:write')).toBe(true);
    expect(hasScope(['contacts:read'], 'products:write')).toBe(false);
    expect(hasScope([], 'contacts:read')).toBe(false);
  });

  it('accepts only known scopes', () => {
    expect(isApiScope('invoices:read')).toBe(true);
    expect(isApiScope('admin:*')).toBe(false);
    expect(isApiScope('*')).toBe(false);
  });
});
