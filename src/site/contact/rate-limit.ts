/**
 * Naive fixed-memory sliding-window limiter, kept per isolate.
 * Good enough to slow down form spam. It is not shared across isolates, so use a
 * Workers rate-limit binding or Turnstile if abuse becomes real.
 */
export interface RateLimiter {
  /** Records an attempt for `key`. Returns false when the key is over the limit. */
  take(key: string): boolean;
}

export function createRateLimiter(opts: {
  max: number;
  windowMs: number;
  now?: () => number;
  /** Upper bound on tracked keys, so memory cannot grow without limit. */
  maxKeys?: number;
}): RateLimiter {
  const now = opts.now ?? Date.now;
  const maxKeys = opts.maxKeys ?? 5000;
  const hits = new Map<string, number[]>();

  return {
    take(key) {
      const current = now();
      const recent = (hits.get(key) ?? []).filter((t) => current - t < opts.windowMs);
      if (recent.length >= opts.max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(current);
      // Re-insert so Map order tracks recency, then evict the oldest keys if needed.
      hits.delete(key);
      hits.set(key, recent);
      if (hits.size > maxKeys) {
        const oldest = hits.keys().next().value;
        if (oldest !== undefined) hits.delete(oldest);
      }
      return true;
    },
  };
}

/** Contact form: 3 messages per IP per hour. */
export const contactRateLimiter = createRateLimiter({ max: 3, windowMs: 60 * 60 * 1000 });
