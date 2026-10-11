import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => {
    throw new Error('not on workers');
  },
}));

import { runInBackground } from '../env';

describe('portal migration tenant isolation', () => {
  const sql = readFileSync(join(process.cwd(), 'drizzle', '0019_w16_portal_tables.sql'), 'utf8');

  it.each(['portal_access_tokens', 'portal_login_requests'])('enables RLS with a company policy on %s', (table) => {
    expect(sql).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    expect(sql).toContain(`CREATE POLICY tenant_isolation ON "${table}" FOR ALL`);
    expect(sql).toContain(`current_setting('app.company_id', true)`);
  });
});

describe('runInBackground', () => {
  it('awaits the task off Workers and never rejects', async () => {
    const seen: string[] = [];
    await runInBackground(Promise.resolve().then(() => seen.push('sent')));
    expect(seen).toEqual(['sent']);
    await expect(runInBackground(Promise.reject(new Error('smtp down')))).resolves.toBeUndefined();
  });
});
