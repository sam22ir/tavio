import type { Ctx } from '@/core/ctx';
import { err, ok, type Result } from '@/core/result';

/** Whether the ctx user may see or act on one record of an entity. Registered by the module that owns the entity. */
export type EntityAccessCheck = (ctx: Ctx, recordId: string) => Promise<boolean>;

const checks = new Map<string, EntityAccessCheck>();

/** Registers the access check for an entity such as crm.lead. A later registration replaces the earlier one. */
export function registerEntityAccess(entity: string, check: EntityAccessCheck): void {
  checks.set(entity, check);
}

/** Entities without a registered check are not restricted by chatter. Out of scope is NOT_FOUND. */
export async function assertEntityAccess(ctx: Ctx, entity: string, recordId: string): Promise<Result<void>> {
  const check = checks.get(entity);
  if (!check) return ok(undefined);
  return (await check(ctx, recordId)) ? ok(undefined) : err('NOT_FOUND', 'Record not found');
}
