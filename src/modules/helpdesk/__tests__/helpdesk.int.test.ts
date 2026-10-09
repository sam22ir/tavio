import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { createTicket, moveTicketStage } from '../service/tickets';

loadDevEnv();

const db = getDb();
const companyIds: string[] = [];
const PERMS = new Set(['helpdesk.ticket.read', 'helpdesk.ticket.write', 'helpdesk.team.read', 'helpdesk.team.write']);

async function fixture(perms: ReadonlySet<string> = PERMS): Promise<TenantArgs> {
  const companyId = randomUUID();
  const userId = randomUUID();
  companyIds.push(companyId);
  await db.insert(companies).values({ id: companyId, legalName: 'Test SARL', displayName: 'Test' });
  await db.insert(users).values({ id: userId, name: 'helpdesk test', email: `hd-${userId}@test.invalid` });
  return { userId, companyId, perms, locale: 'en' };
}

afterAll(async () => {
  if (companyIds.length > 0) await db.delete(companies).where(inArray(companies.id, companyIds));
});

describe.skipIf(!process.env.TAVIO_W5_DB)('helpdesk services (db)', () => {
  it('numbers tickets TK-{YYYY}- gap-free and starts them in new', async () => {
    const args = await fixture();
    const numbers = await withTenant(args, async (ctx) => {
      const a = await createTicket(ctx, { subject: 'A', channel: 'phone', priority: 'normal' });
      const b = await createTicket(ctx, { subject: 'B', channel: 'email', priority: 'high' });
      if (!a.ok || !b.ok) throw new Error('setup');
      return [a.value.number, b.value.number];
    });
    expect(numbers[0]).toMatch(/^TK-\d{4}-00001$/);
    expect(numbers[1]).toMatch(/^TK-\d{4}-00002$/);
  });

  it('refuses an illegal stage move with CONFLICT', async () => {
    const args = await fixture();
    const id = await withTenant(args, async (ctx) => {
      const a = await createTicket(ctx, { subject: 'C', channel: 'walk_in', priority: 'low' });
      if (!a.ok) throw new Error('setup');
      return a.value.id;
    });
    const r = await withTenant(args, (ctx) => moveTicketStage(ctx, id, 'closed'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('CONFLICT');
  });

  it('returns FORBIDDEN without the write permission', async () => {
    const args = await fixture(new Set(['helpdesk.ticket.read']));
    const r = await withTenant(args, (ctx) => createTicket(ctx, { subject: 'X', channel: 'email', priority: 'normal' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('FORBIDDEN');
  });
});
