import { describe, expect, it } from 'vitest';
import type { Db } from '@/core/db/types';
import { contactInput, submitWebsiteContact } from '../service/contact';

// Any database access fails the test. The honeypot path must answer before it touches the database.
const noDb = new Proxy({}, {
  get() {
    throw new Error('database must not be used');
  },
}) as unknown as Db;

const valid = {
  slug: 'boutique',
  name: 'Ahmed Ali',
  phone: '0661000001',
  wilayaCode: '16',
  message: 'Bonjour, je veux un devis.',
};

describe('contactInput', () => {
  it('accepts a complete message and an empty email', () => {
    const r = contactInput.safeParse({ ...valid, email: '' });
    expect(r.success).toBe(true);
  });

  it('rejects a bad wilaya, a short message and a bad email', () => {
    expect(contactInput.safeParse({ ...valid, wilayaCode: '59' }).success).toBe(false);
    expect(contactInput.safeParse({ ...valid, message: 'hi' }).success).toBe(false);
    expect(contactInput.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
  });
});

describe('submitWebsiteContact honeypot', () => {
  it('answers ok and stores nothing when the hidden field is filled', async () => {
    const r = await submitWebsiteContact({ ...valid, website: 'http://spam.example' }, noDb);
    expect(r).toEqual({ ok: true, value: { leadId: null } });
  });

  it('returns VALIDATION for an invalid phone before touching the database', async () => {
    const r = await submitWebsiteContact({ ...valid, phone: 'abc' }, noDb);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('VALIDATION');
  });
});
