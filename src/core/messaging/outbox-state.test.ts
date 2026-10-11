import { describe, expect, it } from 'vitest';
import { applyOutcome, backoffMs, isDue, MAX_ATTEMPTS } from './outbox-state';

const NOW = new Date('2026-10-11T10:00:00Z');
const MIN = 60_000;

describe('retry backoff', () => {
  it('grows 1, 4, 16, 60 minutes and then stays at the cap', () => {
    expect([1, 2, 3, 4].map((n) => backoffMs(n))).toEqual([MIN, 4 * MIN, 16 * MIN, 60 * MIN]);
    expect(backoffMs(9)).toBe(60 * MIN);
  });
});

describe('outbox state machine', () => {
  it('marks a sent message sent with the provider id and time', () => {
    const u = applyOutcome({ attempts: 0 }, { status: 'sent', providerId: 're_1' }, NOW);
    expect(u).toMatchObject({ state: 'sent', attempts: 1, providerId: 're_1', sentAt: NOW, lastError: null });
  });

  it('marks a whatsapp link manual with the wa.me url', () => {
    const u = applyOutcome({ attempts: 0 }, { status: 'manual', url: 'https://wa.me/213?text=x' }, NOW);
    expect(u).toMatchObject({ state: 'manual', attempts: 1, waUrl: 'https://wa.me/213?text=x' });
  });

  it('requeues a failure with backoff and records the error', () => {
    const u = applyOutcome({ attempts: 1 }, { status: 'failed', error: 'Resend 500' }, NOW);
    expect(u.state).toBe('queued');
    expect(u.attempts).toBe(2);
    expect(u.lastError).toBe('Resend 500');
    expect(u.availableAt?.getTime()).toBe(NOW.getTime() + 4 * MIN);
  });

  it('fails the message after MAX_ATTEMPTS failures', () => {
    expect(MAX_ATTEMPTS).toBe(5);
    const u = applyOutcome({ attempts: 4 }, { status: 'failed', error: 'Resend 422' }, NOW);
    expect(u).toMatchObject({ state: 'failed', attempts: 5, lastError: 'Resend 422' });
    expect(u.availableAt).toBeUndefined();
  });

  it('only drains queued rows whose availability has passed', () => {
    expect(isDue({ state: 'queued', availableAt: NOW }, NOW)).toBe(true);
    expect(isDue({ state: 'queued', availableAt: new Date(NOW.getTime() + 1) }, NOW)).toBe(false);
    expect(isDue({ state: 'sent', availableAt: NOW }, NOW)).toBe(false);
  });
});
