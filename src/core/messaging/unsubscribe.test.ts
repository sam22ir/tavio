import { describe, expect, it } from 'vitest';
import { buildUnsubscribeUrl, signUnsubscribe, verifyUnsubscribe } from './unsubscribe';

const payload = { c: '6f1d2c3a-1111-4222-8333-444455556666', p: '7a8b9c0d-1111-4222-8333-444455556666', ch: 'email' as const };
const SECRET = 'secret-for-tests-0123456789';

describe('unsubscribe tokens', () => {
  it('verifies a token it signed', async () => {
    const token = await signUnsubscribe(payload, SECRET);
    await expect(verifyUnsubscribe(token, SECRET)).resolves.toEqual(payload);
  });

  it('rejects a token signed with another secret', async () => {
    const token = await signUnsubscribe(payload, SECRET);
    await expect(verifyUnsubscribe(token, 'other-secret-0123456789abc')).resolves.toBeNull();
  });

  it('rejects a tampered payload', async () => {
    const token = await signUnsubscribe(payload, SECRET);
    const [, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...payload, p: 'someone-else' })).toString('base64url');
    await expect(verifyUnsubscribe(`${forged}.${sig}`, SECRET)).resolves.toBeNull();
  });

  it('rejects malformed input without throwing', async () => {
    await expect(verifyUnsubscribe('', SECRET)).resolves.toBeNull();
    await expect(verifyUnsubscribe('abc', SECRET)).resolves.toBeNull();
    await expect(verifyUnsubscribe('!!.!!', SECRET)).resolves.toBeNull();
  });

  it('builds the public unsubscribe URL with the token', async () => {
    const url = await buildUnsubscribeUrl('https://app.example.test', payload, SECRET);
    expect(url.startsWith('https://app.example.test/api/messaging/unsubscribe?token=')).toBe(true);
    const token = decodeURIComponent(url.split('token=')[1] ?? '');
    await expect(verifyUnsubscribe(token, SECRET)).resolves.toEqual(payload);
  });
});
