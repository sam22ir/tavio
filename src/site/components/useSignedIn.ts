'use client';

import { useEffect, useState } from 'react';

/**
 * Client-side session check for the marketing header. The site is prerendered, so the server
 * never knows who is visiting; the header renders the signed-out CTAs first and swaps to
 * "Open app" once this resolves.
 */
export function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/get-session', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { user?: unknown } | null) => {
        if (!cancelled) setSignedIn(Boolean(data?.user));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return signedIn;
}
