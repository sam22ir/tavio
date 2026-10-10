import { and, eq } from 'drizzle-orm';
import type { Ctx, Locale } from '@/core/ctx';
import { memberships, roles } from '@/core/db/schema';
import type { Tx } from '@/core/db/types';

/**
 * Tenant context for work that an anonymous visitor triggers (checkout, contact form). Anonymous requests
 * have no user, but audit rows and createdBy need a real user id, so the work is attributed to the company
 * owner. Only the listed permissions are granted, and the caller must pass the same tx it writes through.
 */
export async function ownerCtx(
  tx: Tx,
  companyId: string,
  locale: Locale,
  perms: readonly string[],
): Promise<Ctx | null> {
  const [row] = await tx
    .select({ userId: memberships.userId })
    .from(memberships)
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .where(and(eq(memberships.companyId, companyId), eq(memberships.status, 'active'), eq(roles.key, 'owner')))
    .limit(1);
  if (!row) return null;
  return { userId: row.userId, companyId, perms: new Set(perms), locale, tx };
}
