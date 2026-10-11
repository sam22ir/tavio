import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => {
    throw new Error('not on workers');
  },
}));

import { emailChannel, waMeUrl, whatsappChannel, channelFor } from './channels';

const message = { to: 'client@example.com', subject: 'Sujet', html: '<p>x</p>', text: 'x' };

describe('email channel (Resend mocked)', () => {
  beforeEach(() => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('EMAIL_FROM', 'Tavio <no-reply@example.test>');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sends through Resend and returns the provider id', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'em_1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(emailChannel.send(message)).resolves.toEqual({ status: 'sent', providerId: 'em_1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a Resend error as failed with its message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'bad from' }), { status: 422 })));
    await expect(emailChannel.send(message)).resolves.toEqual({ status: 'failed', error: 'Resend 422: bad from' });
  });

  it('reports a network error as failed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('socket hang up');
    }));
    await expect(emailChannel.send(message)).resolves.toEqual({ status: 'failed', error: 'socket hang up' });
  });
});

describe('whatsapp channel (manual stub)', () => {
  it('builds a wa.me link with digits only and an encoded text', () => {
    expect(waMeUrl('+213 555-12 34', 'Bonjour & merci')).toBe('https://wa.me/2135551234?text=Bonjour%20%26%20merci');
  });

  it('returns a manual result instead of sending', async () => {
    const res = await whatsappChannel.send({ ...message, to: '+213555123456' });
    expect(res).toEqual({ status: 'manual', url: 'https://wa.me/213555123456?text=x' });
  });

  it('looks channels up by id', () => {
    expect(channelFor('email')?.id).toBe('email');
    expect(channelFor('sms')).toBeNull();
  });
});
