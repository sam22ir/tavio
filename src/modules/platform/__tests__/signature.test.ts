import { describe, expect, it } from 'vitest';
import { signPayload, verifySignature } from '../service/signature';

describe('webhook signature', () => {
  const body = JSON.stringify({ id: '1', event: 'pos.order.paid', data: { total: '1500.00' } });

  it('produces sha256=<hex> over the exact body', () => {
    expect(signPayload('secret', body)).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('is deterministic for the same secret and body', () => {
    expect(signPayload('secret', body)).toBe(signPayload('secret', body));
  });

  it('changes with the secret or the body', () => {
    const sig = signPayload('secret', body);
    expect(signPayload('other', body)).not.toBe(sig);
    expect(signPayload('secret', body + ' ')).not.toBe(sig);
  });

  it('verifies a correct signature and rejects tampering', () => {
    const sig = signPayload('secret', body);
    expect(verifySignature('secret', body, sig)).toBe(true);
    expect(verifySignature('secret', body.replace('1500', '1'), sig)).toBe(false);
    expect(verifySignature('wrong', body, sig)).toBe(false);
    expect(verifySignature('secret', body, 'sha256=00')).toBe(false);
  });
});
