import type { Ctx } from '@/core/ctx';
import { auditLog } from '@/core/db/schema';

export interface AuditEntry {
  entity: string;
  recordId: string;
  action: string;
  before?: unknown;
  after?: unknown;
}

// jsonb cannot hold bigint, so bigints are written as strings.
function toJsonSafe(value: unknown): unknown {
  if (value === undefined) return null;
  return JSON.parse(
    JSON.stringify(value, (_key, v: unknown) => (typeof v === 'bigint' ? v.toString() : v)),
  ) as unknown;
}

// Appends one row to audit_log inside the caller's transaction.
export async function audit(ctx: Ctx, entry: AuditEntry): Promise<void> {
  const changes =
    entry.before === undefined && entry.after === undefined
      ? null
      : { before: toJsonSafe(entry.before), after: toJsonSafe(entry.after) };
  await ctx.tx.insert(auditLog).values({
    companyId: ctx.companyId,
    actorUserId: ctx.userId,
    actorType: 'user',
    action: entry.action,
    entity: entry.entity,
    recordId: entry.recordId,
    changes,
    createdBy: ctx.userId,
  });
}
