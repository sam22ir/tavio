// STUB owned by P00-W2-D.
import type { Ctx } from '@/core/ctx';
import type { Db } from '@/core/db/types';
export interface DomainEvent<P = unknown> { name: string; payload: P }
export interface OutboxRow { id: string; companyId: string; eventName: string; payload: unknown; attempts: number }
export type EventHandler = (ctx: Ctx, event: DomainEvent) => Promise<void>;
/** Registers a synchronous in-transaction handler. */
export function on(_name: string, _handler: EventHandler): void { throw new Error('not implemented'); }
/** Runs sync handlers in ctx.tx, then writes an outbox row for async consumers. */
export async function emit(_ctx: Ctx, _event: DomainEvent): Promise<void> { throw new Error('not implemented'); }
/** Claims up to `limit` pending outbox rows (FOR UPDATE SKIP LOCKED), runs handle, marks done or increments attempts. Returns processed count. */
export async function drainOutbox(_db: Db, _handle: (row: OutboxRow) => Promise<void>, _limit?: number): Promise<number> { throw new Error('not implemented'); }
