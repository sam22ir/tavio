import { and, asc, eq, sql } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { outbox } from '@/core/db/schema';
import type { Db } from '@/core/db/types';

export interface DomainEvent<P = unknown> { name: string; payload: P }
export interface OutboxRow { id: string; companyId: string; eventName: string; payload: unknown; attempts: number }
export type EventHandler = (ctx: Ctx, event: DomainEvent) => Promise<void>;

const MAX_ATTEMPTS = 5;

const handlers = new Map<string, EventHandler[]>();

/** Registers a synchronous in-transaction handler. */
export function on(name: string, handler: EventHandler): void {
  const list = handlers.get(name);
  if (list) list.push(handler);
  else handlers.set(name, [handler]);
}

/** Runs sync handlers in ctx.tx, then writes an outbox row for async consumers. */
export async function emit(ctx: Ctx, event: DomainEvent): Promise<void> {
  for (const handler of handlers.get(event.name) ?? []) {
    await handler(ctx, event);
  }
  await ctx.tx.insert(outbox).values({
    companyId: ctx.companyId,
    createdBy: ctx.userId,
    eventType: event.name,
    payload: event.payload as object,
    status: 'pending',
  });
}

/**
 * Claims up to `limit` pending outbox rows (FOR UPDATE SKIP LOCKED), runs handle, marks done or increments attempts.
 * Runs in its own transaction. A handler error is recorded on the row and does not roll back the batch.
 * Returns the number of rows marked done.
 */
export async function drainOutbox(
  db: Db,
  handle: (row: OutboxRow) => Promise<void>,
  limit = 10,
): Promise<number> {
  return db.transaction(async (tx) => {
    const claimed = await tx
      .select()
      .from(outbox)
      .where(eq(outbox.status, 'pending'))
      .orderBy(asc(outbox.createdAt))
      .limit(limit)
      .for('update', { skipLocked: true });

    let done = 0;
    for (const row of claimed) {
      try {
        await handle({
          id: row.id,
          companyId: row.companyId,
          eventName: row.eventType,
          payload: row.payload,
          attempts: row.attempts,
        });
        await tx
          .update(outbox)
          .set({ status: 'done', processedAt: sql`now()`, updatedAt: sql`now()` })
          .where(and(eq(outbox.id, row.id), eq(outbox.status, 'pending')));
        done += 1;
      } catch (err) {
        const attempts = row.attempts + 1;
        const message = err instanceof Error ? err.message : String(err);
        await tx
          .update(outbox)
          .set({
            attempts,
            lastError: message,
            status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
            updatedAt: sql`now()`,
          })
          .where(eq(outbox.id, row.id));
      }
    }
    return done;
  });
}
