import { getCloudflareContext } from '@opennextjs/cloudflare';

// Same order as the email adapter: Workers bindings first, then process.env (Node, tests, local dev).
export function readPortalEnv(name: string): string | undefined {
  try {
    const fromWorker = (getCloudflareContext({ async: false }).env as Record<string, string | undefined>)[name];
    if (fromWorker) return fromWorker;
  } catch {
    // Not running on Workers.
  }
  return process.env[name] || undefined;
}

/** Secret the portal session key is derived from. Null when unset, in which case portal sessions are refused. */
export function readPortalSecret(): string | null {
  return readPortalEnv('BETTER_AUTH_SECRET') ?? null;
}

/** Public origin for absolute portal links: PORTAL_BASE_URL, else BETTER_AUTH_URL. Null when neither is set. */
export function readPortalBaseUrl(): string | null {
  const value = readPortalEnv('PORTAL_BASE_URL') ?? readPortalEnv('BETTER_AUTH_URL');
  return value ? value.replace(/\/+$/, '') : null;
}

/** Feature flag for the online payment button. Off unless PORTAL_PAYMENTS is exactly "true". */
export function portalPaymentsEnabled(): boolean {
  return readPortalEnv('PORTAL_PAYMENTS') === 'true';
}
