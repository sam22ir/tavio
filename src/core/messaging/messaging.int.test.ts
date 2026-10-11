import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { getDb } from '@/core/db/client';
import { companies, outboundMessages } from '@/core/db/schema';
import type { Ctx } from '@/core/ctx';
import type { Db } from '@/core/db/types';
import { drainMessages, queueMessage } from './outbox';

loadDevEnv();

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => {
    throw new Error('not on workers');
  },
}));

// Runs once the integrator has migrated the messaging tables and RLS (TAVIO_W5_DB set).
describe.skipIf(!process.env.TAVIO_W5_DB)('messaging queue to cron send (database)', () => {
  const db: Db = getDb();
  const created: string[] = [];

  afterAll(async () => {
    for (const id of created) await db.delete(companies).where(eq(companies.id, id));
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('queues inside a transaction, drains through the mocked Resend fetch, and records sent', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('EMAIL_FROM', 'Tavio <no-reply@example.test>');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'em_int' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const [company] = await db.insert(companies).values({ legalName: 'Msg A', displayName: 'Msg A' }).returning({ id: companies.id });
    if (!company) throw new Error('company insert failed');
    created.push(company.id);

    const id = await db.transaction(async (tx) => {
      const ctx: Ctx = { userId: randomUUID(), companyId: company.id, perms: new Set(['*']), locale: 'fr', tx };
      const res = await queueMessage(ctx, { channel: 'email', to: 'client@example.test', subject: 'S', html: '<p>x</p>', text: 'x' });
      if (!res.ok || !res.value.id) throw new Error('queue failed');
      return res.value.id;
    });

    const drained = await drainMessages(db, 50);
    expect(drained.sent).toBeGreaterThanOrEqual(1);
    expect(fetchMock).toHaveBeenCalled();
    const [row] = await db.select().from(outboundMessages).where(eq(outboundMessages.id, id));
    expect(row?.state).toBe('sent');
    expect(row?.providerId).toBe('em_int');
    expect(row?.sentAt).not.toBeNull();
    await db.execute(sql`select 1`);
  });
});
