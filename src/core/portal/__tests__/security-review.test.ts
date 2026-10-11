import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => {
    throw new Error('not on workers');
  },
}));

import { runInBackground } from '../env';

// Every tenant table created from wave 13 on (migration 0011+) must enable RLS, carry the
// tenant_isolation policy and be granted to tavio_app (the 0009 ALL TABLES grant predates them).
describe('tenant tables created since 0011 are isolated and granted', () => {
  const dir = join(process.cwd(), 'drizzle');
  const files = readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f) && Number(f.slice(0, 4)) >= 11);
  const all = files.map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
  const tenantTables = [...all.matchAll(/CREATE TABLE "([a-z0-9_]+)" \(([\s\S]*?)\n\);/g)]
    .filter(([, , body]) => /"company_id" uuid NOT NULL/.test(body ?? ''))
    .map(([, name]) => name as string);

  it('finds the new tenant tables', () => {
    expect(tenantTables).toEqual(expect.arrayContaining(['portal_access_tokens', 'outbound_messages']));
  });

  it.each(tenantTables)('%s has RLS, the tenant policy and a grant', (table) => {
    const t = `"?${table}"?`;
    expect(all).toMatch(new RegExp(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`));
    expect(all).toMatch(new RegExp(`CREATE POLICY tenant_isolation ON ${t} FOR ALL`));
    // Grants may list several tables: GRANT ... ON a, b, c TO tavio_app.
    expect(all).toMatch(new RegExp(`GRANT SELECT, INSERT, UPDATE, DELETE ON [^;]*\\b${table}\\b[^;]* TO tavio_app`));
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
