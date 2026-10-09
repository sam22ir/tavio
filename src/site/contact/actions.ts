'use server';

import { headers } from 'next/headers';
import { sendEmail } from '@/core/adapters/email';
import { contactRateLimiter } from './rate-limit';
import { processContact } from './process';

export interface ContactState {
  status: 'idle' | 'sent' | 'invalid' | 'rate_limited' | 'error';
  fieldErrors?: Record<string, true>;
}

/** Server action behind the contact form. Never throws into the page. */
export async function submitContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  try {
    const h = await headers();
    const ip = h.get('cf-connecting-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const outcome = await processContact(Object.fromEntries(formData), ip, {
      send: sendEmail,
      limiter: contactRateLimiter,
      recipient: process.env.CONTACT_EMAIL || process.env.EMAIL_FROM,
    });
    if (outcome.status === 'invalid') return { status: 'invalid', fieldErrors: outcome.fieldErrors };
    return { status: outcome.status };
  } catch (err) {
    console.error('submitContact failed', { name: err instanceof Error ? err.name : 'unknown' });
    return { status: 'error' };
  }
}
