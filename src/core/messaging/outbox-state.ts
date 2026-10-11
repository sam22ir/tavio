// Pure outbox state machine and retry policy. No DB, no IO.
// queued -> sent | manual | failed | queued (retry). sent, manual and failed are terminal for the drain.

export const MAX_ATTEMPTS = 5;
const MINUTE_MS = 60_000;
const MAX_BACKOFF_MS = 60 * MINUTE_MS;

export type MessageState = 'queued' | 'sent' | 'failed' | 'manual';

/** Delay before retry number `attempts` (1 = after the first failure): 1, 4, 16, 60 minutes, then capped. */
export function backoffMs(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  return Math.min(MINUTE_MS * 4 ** exponent, MAX_BACKOFF_MS);
}

export type SendOutcome =
  | { status: 'sent'; providerId?: string }
  | { status: 'manual'; url: string }
  | { status: 'failed'; error: string };

export interface OutboxUpdate {
  state: MessageState;
  attempts: number;
  availableAt?: Date;
  lastError: string | null;
  providerId?: string | null;
  sentAt?: Date;
  waUrl?: string | null;
}

/** Turns a send outcome into the row update. A failure is retried until MAX_ATTEMPTS, then the row is failed. */
export function applyOutcome(current: { attempts: number }, outcome: SendOutcome, now: Date): OutboxUpdate {
  const attempts = current.attempts + 1;
  switch (outcome.status) {
    case 'sent':
      return { state: 'sent', attempts, lastError: null, providerId: outcome.providerId ?? null, sentAt: now };
    case 'manual':
      return { state: 'manual', attempts, lastError: null, waUrl: outcome.url };
    case 'failed':
      if (attempts >= MAX_ATTEMPTS) {
        return { state: 'failed', attempts, lastError: outcome.error };
      }
      return {
        state: 'queued',
        attempts,
        availableAt: new Date(now.getTime() + backoffMs(attempts)),
        lastError: outcome.error,
      };
  }
}

/** A queued row is due when its availability time has passed. */
export function isDue(row: { state: string; availableAt: Date }, now: Date): boolean {
  return row.state === 'queued' && row.availableAt.getTime() <= now.getTime();
}
