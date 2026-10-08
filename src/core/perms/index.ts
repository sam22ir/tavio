import type { Ctx } from '../ctx';
import { err, ok, type Result } from '../result';

export const OWNER_PERMS: ReadonlySet<string> = new Set(['*']);

export function can(perms: ReadonlySet<string>, perm: string): boolean {
  if (perms.has(perm) || perms.has('*')) return true;
  for (const granted of perms) {
    if (granted.endsWith('.*') && perm.startsWith(granted.slice(0, -1))) return true;
  }
  return false;
}

export function requirePerm(ctx: Pick<Ctx, 'perms'>, perm: string): Result<void> {
  if (can(ctx.perms, perm)) return ok(undefined);
  return err('FORBIDDEN', `Missing permission ${perm}`, { perm });
}
