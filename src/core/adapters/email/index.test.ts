import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => {
    throw new Error('not on workers');
  },
}));

import { emailConfigured, sendEmail } from './index';

const message = { to: 'user@example.com', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' };

describe('email adapter', () => {
  beforeEach(() => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('EMAIL_FROM', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('is not configured without both env vars', () => {
    expect(emailConfigured()).toBe(false);
    vi.stubEnv('RESEND_API_KEY', 're_test');
    expect(emailConfigured()).toBe(false);
  });

  it('returns sent false and logs a redacted line when not configured', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await sendEmail(message);
    expect(result).toEqual({ sent: false });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith('[email] not configured; would send', 'Hi', '→', 'u***@example.com');
  });

  it('posts to Resend when configured and returns the id', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('EMAIL_FROM', 'Tavio <no-reply@example.com>');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ id: 'em_1' }), { status: 200 }));
    const result = await sendEmail({ ...message, replyTo: 'support@example.com' });
    expect(result).toEqual({ sent: true, id: 'em_1' });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test_key');
    expect(JSON.parse(init.body as string)).toEqual({
      from: 'Tavio <no-reply@example.com>',
      to: 'user@example.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
      reply_to: 'support@example.com',
    });
  });

  it('returns an error instead of throwing when the API rejects', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('EMAIL_FROM', 'no-reply@example.com');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid from' }), { status: 422 }),
    );
    const result = await sendEmail(message);
    expect(result).toEqual({ sent: false, error: 'Resend 422: Invalid from' });
  });

  it('returns an error instead of throwing on network failure', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('EMAIL_FROM', 'no-reply@example.com');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const result = await sendEmail(message);
    expect(result).toEqual({ sent: false, error: 'offline' });
  });
});
