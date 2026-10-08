import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDevEnv } from '../env/load-dev-env';
import { getDb } from './client';
import { withTenant, type TenantArgs } from './tenant';
import type { Db } from './types';

loadDevEnv();

// Owner connection writes need the tenant set when FORCE RLS applies to the owner.
async function asOwner<T>(companyId: string, fn: (db: Db) => Promise<T>): Promise<T> {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.company_id', ${companyId}, true)`);
    return fn(tx as unknown as Db);
  });
}

const argsFor = (companyId: string): TenantArgs => ({
  userId: randomUUID(),
  companyId,
  perms: new Set<string>(),
  locale: 'en',
});

describe('core RLS', () => {
  const companyA = randomUUID();
  const companyB = randomUUID();
  const roleA = randomUUID();
  const roleB = randomUUID();

  beforeAll(async () => {
    const db = getDb();
    await db.execute(
      sql`insert into companies (id, legal_name, display_name) values (${companyA}, 'RLS A', 'RLS A'), (${companyB}, 'RLS B', 'RLS B')`,
    );
    await asOwner(companyA, (tx) =>
      tx.execute(sql`insert into roles (id, company_id, key, name, is_system) values (${roleA}, ${companyA}, 'rls_test', 'A', false)`),
    );
    await asOwner(companyB, (tx) =>
      tx.execute(sql`insert into roles (id, company_id, key, name, is_system) values (${roleB}, ${companyB}, 'rls_test', 'B', false)`),
    );
  });

  afterAll(async () => {
    const db = getDb();
    await asOwner(companyA, (tx) => tx.execute(sql`delete from roles where id = ${roleA}`));
    await asOwner(companyB, (tx) => tx.execute(sql`delete from roles where id = ${roleB}`));
    await db.execute(sql`delete from companies where id in (${companyA}, ${companyB})`);
  });

  it('shows only the tenant own rows', async () => {
    const rows = await withTenant(argsFor(companyA), async (ctx) => {
      const r = await ctx.tx.execute(sql`select id from roles where key = 'rls_test'`);
      return r.rows.map((x) => x.id);
    });
    expect(rows).toEqual([roleA]);
  });

  it('rejects an insert with another company_id', async () => {
    await expect(
      withTenant(argsFor(companyA), async (ctx) => {
        await ctx.tx.execute(
          sql`insert into roles (id, company_id, key, name, is_system) values (${randomUUID()}, ${companyB}, 'rls_bad', 'X', false)`,
        );
      }),
    ).rejects.toThrow();
  });

  it('returns no rows when no tenant is set', async () => {
    const db = getDb();
    const count = await db.transaction(async (tx) => {
      await tx.execute(sql`set local role tavio_app`);
      const r = await tx.execute(sql`select count(*)::int as n from roles where key = 'rls_test'`);
      return r.rows[0]?.n;
    });
    expect(count).toBe(0);
  });
});
