import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadDevEnv } from '../env/load-dev-env';
import { getDb } from '../db/client';
import { users } from '../db/schema';
import { withTenant, type TenantArgs } from '../db/tenant';
import { audit } from './index';

loadDevEnv();

const userId = randomUUID();
const args = (): TenantArgs => ({
  userId,
  companyId: randomUUID(),
  perms: new Set<string>(),
  locale: 'en',
});

// audit_log.created_by references users, so the test user is inserted once here.
// audit_log is append-only (UPDATE and DELETE are trigger-rejected), so test rows keep random uuids and stay.
beforeAll(async () => {
  await getDb()
    .insert(users)
    .values({ id: userId, name: 'audit test', email: `audit-${userId}@test.invalid` });
});

async function countRows(a: TenantArgs, recordId: string): Promise<number> {
  return withTenant(a, async (ctx) => {
    const r = await ctx.tx.execute(
      sql`select count(*)::int as n from audit_log where record_id = ${recordId}`,
    );
    return (r.rows[0] as { n: number }).n;
  });
}

describe('audit', () => {
  it('writes a row inside the transaction and it disappears on rollback', async () => {
    const a = args();
    const recordId = randomUUID();

    await withTenant(a, async (ctx) => {
      await audit(ctx, { entity: 'core.test', recordId, action: 'create', after: { qty: BigInt(5) } });
    });
    expect(await countRows(a, recordId)).toBe(1);

    const rolledBackId = randomUUID();
    await expect(
      withTenant(a, async (ctx) => {
        await audit(ctx, { entity: 'core.test', recordId: rolledBackId, action: 'create' });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(await countRows(a, rolledBackId)).toBe(0);
  });
});
