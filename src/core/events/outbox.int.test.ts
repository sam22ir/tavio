import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { loadDevEnv } from '../env/load-dev-env';
import { getDb } from '../db/client';
import { outbox, users } from '../db/schema';
import type { Ctx } from '../ctx';
import type { Db, Tx } from '../db/types';
import { drainOutbox, emit, on } from './index';

loadDevEnv();

const ROLLBACK = new Error('rollback');

// Runs fn inside a transaction that is always rolled back, so no rows or changes persist in the shared DB.
// Other pending outbox rows are marked done inside that transaction so drain only sees this test's rows.
async function withRollback(fn: (tx: Tx) => Promise<void>): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.execute(sql`update outbox set status = 'done' where status = 'pending'`);
    await fn(tx);
    throw ROLLBACK;
  }).catch((err) => {
    if (err !== ROLLBACK) throw err;
  });
}

// outbox.created_by references users, so each test inserts a real user inside its rolled-back transaction.
async function ctxFor(tx: Tx, companyId: string): Promise<Ctx> {
  const userId = randomUUID();
  await tx.insert(users).values({ id: userId, name: 'Outbox Test', email: `outbox-${userId}@example.test` });
  return { userId, companyId, perms: new Set<string>(), locale: 'en', tx };
}

async function rowFor(tx: Tx, companyId: string) {
  const [row] = await tx.select().from(outbox).where(eq(outbox.companyId, companyId));
  if (!row) throw new Error('outbox row missing');
  return row;
}

// drain runs on a nested transaction (savepoint) of the test transaction.
const asDb = (tx: Tx) => tx as unknown as Db;

describe('outbox', () => {
  it('emit writes a pending row and drain marks it done', async () => {
    const companyId = randomUUID();
    await withRollback(async (tx) => {
      on('test.outbox.int', async () => undefined);
      await emit(await ctxFor(tx, companyId), { name: 'test.outbox.int', payload: { ok: true } });

      const seen: string[] = [];
      const processed = await drainOutbox(asDb(tx), async (row) => {
        if (row.companyId === companyId) seen.push(row.eventName);
      });

      expect(processed).toBeGreaterThanOrEqual(1);
      expect(seen).toEqual(['test.outbox.int']);
      const row = await rowFor(tx, companyId);
      expect(row.status).toBe('done');
      expect(row.processedAt).not.toBeNull();
    });
  });

  it('a failing handler increments attempts, stores last_error, and fails after 5 attempts', async () => {
    const companyId = randomUUID();
    await withRollback(async (tx) => {
      await emit(await ctxFor(tx, companyId), { name: 'test.outbox.int', payload: {} });
      const failing = async () => { throw new Error('send failed'); };

      for (let i = 1; i <= 4; i++) {
        await drainOutbox(asDb(tx), failing);
        const row = await rowFor(tx, companyId);
        expect(row.attempts).toBe(i);
        expect(row.lastError).toBe('send failed');
        expect(row.status).toBe('pending');
      }
      await drainOutbox(asDb(tx), failing);
      const row = await rowFor(tx, companyId);
      expect(row.attempts).toBe(5);
      expect(row.status).toBe('failed');
    });
  });
});
