import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDevEnv } from '../env/load-dev-env';
import { getDb } from './client';
import { withTenant, type TenantArgs } from './tenant';
import type { Db } from './types';

loadDevEnv();

const args = (): TenantArgs => ({
  userId: randomUUID(),
  companyId: randomUUID(),
  perms: new Set<string>(),
  locale: 'en',
});

describe('withTenant', () => {
  // One connection so a temp table created in the test is visible to every query in it.
  let pool: Pool;
  let db: Db;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    db = drizzle(pool);
    await db.execute(sql`create temp table if not exists tenant_probe (v int)`);
  });

  afterAll(async () => {
    await db.execute(sql`drop table if exists tenant_probe`);
    await pool.end();
  });

  it('sets app.company_id inside the transaction', async () => {
    const a = args();
    const seen = await withTenant(a, async (ctx) => {
      const rows = await ctx.tx.execute(sql`select current_setting('app.company_id', true) as v`);
      return rows.rows[0]?.v;
    }, getDb());
    expect(seen).toBe(a.companyId);
  });

  it('does not leak the tenant setting after the transaction', async () => {
    const pool2 = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    try {
      await withTenant(args(), async () => undefined, getDb());
      const rows = await pool2.query(`select current_setting('app.company_id', true) as v`);
      expect(rows.rows[0].v === null || rows.rows[0].v === '').toBe(true);
    } finally {
      await pool2.end();
    }
  });

  it('rolls back the transaction when fn throws', async () => {
    await expect(
      withTenant(args(), async (ctx) => {
        await ctx.tx.execute(sql`insert into tenant_probe (v) values (1)`);
        throw new Error('boom');
      }, db),
    ).rejects.toThrow('boom');
    const rows = await db.execute(sql`select count(*)::int as n from tenant_probe`);
    expect(rows.rows[0]?.n).toBe(0);
  });

  it('rejects non-UUID company ids', async () => {
    await expect(withTenant({ ...args(), companyId: 'not-a-uuid' }, async () => 1, db)).rejects.toThrow(
      'companyId must be a UUID',
    );
  });
});
