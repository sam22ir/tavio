import { describe, expect, it, vi } from 'vitest';
import { processContact, type ContactDeps } from './process';
import { contactSchema } from './schema';
import { createRateLimiter } from './rate-limit';

const valid = {
  name: 'Karim Benali',
  company: 'Électro Benali',
  phone: '0550 12 34 56',
  email: 'karim@example.dz',
  wilaya: 'Oran',
  message: 'Nous voulons gérer nos ventes à crédit.',
  website: '',
};

function deps(overrides: Partial<ContactDeps> = {}): ContactDeps & { send: ReturnType<typeof vi.fn> } {
  const send = vi.fn(async () => ({ sent: true }));
  return {
    send,
    limiter: createRateLimiter({ max: 3, windowMs: 60_000 }),
    recipient: 'team@revora.test',
    ...overrides,
  } as ContactDeps & { send: ReturnType<typeof vi.fn> };
}

describe('contactSchema', () => {
  it('accepts a complete submission and normalises the phone number', () => {
    const parsed = contactSchema.parse(valid);
    expect(parsed.phone).toBe('0550123456');
  });

  it('accepts +213 numbers', () => {
    expect(contactSchema.safeParse({ ...valid, phone: '+213 550-12-34-56' }).success).toBe(true);
  });

  it('rejects a phone number that is not Algerian', () => {
    expect(contactSchema.safeParse({ ...valid, phone: '12345' }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, phone: '+33 6 12 34 56 78' }).success).toBe(false);
  });

  it('rejects an invalid email and a short message', () => {
    expect(contactSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, message: 'court' }).success).toBe(false);
  });

  it('requires name and wilaya, and makes company optional', () => {
    expect(contactSchema.safeParse({ ...valid, name: ' ' }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, wilaya: '' }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, company: undefined }).success).toBe(true);
  });
});

describe('contact type', () => {
  it('defaults to other and rejects unknown types', () => {
    expect(contactSchema.parse(valid).type).toBe('other');
    expect(contactSchema.safeParse({ ...valid, type: 'hack' }).success).toBe(false);
  });

  it('puts the request type in the email subject and body', async () => {
    const d = deps();
    await processContact({ ...valid, type: 'audit' }, '5.5.5.5', d);
    const mail = d.send.mock.calls[0]?.[0];
    expect(mail?.subject).toBe('Nouveau contact Revora [Audit gratuit] : Électro Benali');
    expect(mail?.text).toContain('Motif : Audit gratuit');
  });
});

describe('processContact', () => {
  it('sends an email with the reply-to set to the visitor', async () => {
    const d = deps();
    const outcome = await processContact({ ...valid }, '1.2.3.4', d);
    expect(outcome).toEqual({ status: 'sent' });
    expect(d.send).toHaveBeenCalledTimes(1);
    const mail = d.send.mock.calls[0]?.[0];
    expect(mail?.to).toBe('team@revora.test');
    expect(mail?.replyTo).toBe('karim@example.dz');
  });

  it('escapes HTML in the email body', async () => {
    const d = deps();
    await processContact({ ...valid, message: '<script>alert(1)</script> bonjour' }, '1.2.3.4', d);
    const mail = d.send.mock.calls[0]?.[0];
    expect(mail?.html).not.toContain('<script>');
    expect(mail?.html).toContain('&lt;script&gt;');
  });

  it('honeypot: a filled hidden field reports success and sends nothing', async () => {
    const d = deps();
    const outcome = await processContact({ ...valid, website: 'http://spam.example' }, '1.2.3.4', d);
    expect(outcome).toEqual({ status: 'sent' });
    expect(d.send).not.toHaveBeenCalled();
  });

  it('honeypot: a filled field does not consume the rate limit', async () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
    const d = deps({ limiter });
    await processContact({ ...valid, website: 'bot' }, '1.2.3.4', d);
    const outcome = await processContact({ ...valid }, '1.2.3.4', d);
    expect(outcome).toEqual({ status: 'sent' });
  });

  it('returns field errors for invalid input and sends nothing', async () => {
    const d = deps();
    const outcome = await processContact({ ...valid, email: 'bad', phone: '1' }, '1.2.3.4', d);
    expect(outcome.status).toBe('invalid');
    if (outcome.status === 'invalid') {
      expect(outcome.fieldErrors).toEqual({ email: true, phone: true });
    }
    expect(d.send).not.toHaveBeenCalled();
  });

  it('rate limit: the 4th real attempt from one IP within the window is refused', async () => {
    const d = deps();
    for (let i = 0; i < 3; i++) {
      expect((await processContact({ ...valid }, '9.9.9.9', d)).status).toBe('sent');
    }
    expect(await processContact({ ...valid }, '9.9.9.9', d)).toEqual({ status: 'rate_limited' });
    expect(d.send).toHaveBeenCalledTimes(3);
  });

  it('rate limit: other IPs are not affected', async () => {
    const d = deps({ limiter: createRateLimiter({ max: 1, windowMs: 60_000 }) });
    expect((await processContact({ ...valid }, '1.1.1.1', d)).status).toBe('sent');
    expect((await processContact({ ...valid }, '2.2.2.2', d)).status).toBe('sent');
  });

  it('counts invalid attempts toward the rate limit', async () => {
    const d = deps({ limiter: createRateLimiter({ max: 1, windowMs: 60_000 }) });
    await processContact({ ...valid, email: 'bad' }, '3.3.3.3', d);
    expect(await processContact({ ...valid }, '3.3.3.3', d)).toEqual({ status: 'rate_limited' });
  });

  it('reports error when no recipient is configured', async () => {
    const d = deps({ recipient: undefined });
    expect(await processContact({ ...valid }, '4.4.4.4', d)).toEqual({ status: 'error' });
  });

  it('reports error when the mail provider fails', async () => {
    const d = deps({ send: vi.fn(async () => ({ sent: false, error: 'boom' })) });
    expect(await processContact({ ...valid }, '5.5.5.5', d)).toEqual({ status: 'error' });
  });
});

describe('createRateLimiter', () => {
  it('frees a key once the window has passed', () => {
    let now = 0;
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, now: () => now });
    expect(limiter.take('k')).toBe(true);
    expect(limiter.take('k')).toBe(false);
    now = 1000;
    expect(limiter.take('k')).toBe(true);
  });

  it('bounds the number of tracked keys', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 2 });
    limiter.take('a');
    limiter.take('b');
    limiter.take('c');
    // 'a' was evicted, so it is allowed again.
    expect(limiter.take('a')).toBe(true);
  });
});
