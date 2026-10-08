import { afterEach, describe, expect, it, vi } from 'vitest';

const getCloudflareContext = vi.fn();
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext }));

describe('getDb', () => {
  afterEach(() => {
    vi.resetModules();
    getCloudflareContext.mockReset();
    vi.unstubAllEnvs();
  });

  it('falls back to the Node singleton when getCloudflareContext throws', async () => {
    getCloudflareContext.mockImplementation(() => {
      throw new Error('no cloudflare context');
    });
    vi.stubEnv('DATABASE_URL', 'postgres://user:pass@localhost:5432/test');
    const { getDb } = await import('./client');
    const first = getDb();
    expect(first).toBeDefined();
    expect(getDb()).toBe(first);
  }, 30_000);

  it('throws when DATABASE_URL is missing on the Node path', async () => {
    getCloudflareContext.mockImplementation(() => {
      throw new Error('no cloudflare context');
    });
    vi.stubEnv('DATABASE_URL', '');
    const { getDb } = await import('./client');
    expect(() => getDb()).toThrow('DATABASE_URL is not set');
  }, 30_000);
});
