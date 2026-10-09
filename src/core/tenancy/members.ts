// Team members (W6-B). Runs on the owner connection with explicit company checks, like service.ts.
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '@/core/db/client';
import { memberships, roles, users } from '@/core/db/schema';
import type { Db } from '@/core/db/types';
import { err, ok, type Result } from '@/core/result';

export const MEMBER_ROLE_KEYS = ['owner', 'admin', 'manager', 'staff'] as const;
export type MemberRoleKey = (typeof MEMBER_ROLE_KEYS)[number];

export interface MemberRow {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  roleKey: string;
  roleId: string;
}

export function isMemberRoleKey(value: string): value is MemberRoleKey {
  return (MEMBER_ROLE_KEYS as readonly string[]).includes(value);
}

/** Owners and admins manage the team. */
export function canManageTeam(roleKey: string | null): boolean {
  return roleKey === 'owner' || roleKey === 'admin';
}

/** The caller's active role key in the company, or null when not an active member. */
export async function getMemberRole(userId: string, companyId: string, db: Db = getDb()): Promise<string | null> {
  const [row] = await db
    .select({ roleKey: roles.key })
    .from(memberships)
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.companyId, companyId),
        eq(memberships.status, 'active'),
      ),
    );
  return row?.roleKey ?? null;
}

export async function listMembers(companyId: string, db: Db = getDb()): Promise<MemberRow[]> {
  return db
    .select({
      membershipId: memberships.id,
      userId: memberships.userId,
      name: users.name,
      email: users.email,
      roleKey: roles.key,
      roleId: roles.id,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .where(and(eq(memberships.companyId, companyId), eq(memberships.status, 'active')))
    .orderBy(asc(users.name));
}

async function assertManager(userId: string, companyId: string, db: Db): Promise<Result<void>> {
  const role = await getMemberRole(userId, companyId, db);
  if (!canManageTeam(role)) return err('FORBIDDEN', 'only owners and admins manage the team');
  return ok(undefined);
}

export async function changeRole(
  actorUserId: string,
  companyId: string,
  membershipId: string,
  roleKey: string,
  db: Db = getDb(),
): Promise<Result<void>> {
  if (!isMemberRoleKey(roleKey)) return err('VALIDATION', 'unknown role');
  const actorRole = await getMemberRole(actorUserId, companyId, db);
  const manager = await assertManager(actorUserId, companyId, db);
  if (!manager.ok) return manager;

  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ roleKey: roles.key, status: memberships.status })
      .from(memberships)
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(and(eq(memberships.id, membershipId), eq(memberships.companyId, companyId)))
      .for('update', { of: memberships });
    if (!target || target.status !== 'active') return err('NOT_FOUND', 'member not found');
    if (target.roleKey === 'owner' && actorRole !== 'owner') return err('FORBIDDEN', 'only owners manage owners');
    if (target.roleKey === 'owner' && roleKey !== 'owner') {
      const owners = await lockOwners(tx, companyId);
      if (owners <= 1) return err('STATE', 'cannot demote the last owner', { reason: 'last_owner' });
    }
    const [role] = await tx
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.companyId, companyId), eq(roles.key, roleKey)));
    if (!role) return err('NOT_FOUND', 'role not found');
    await tx.update(memberships).set({ roleId: role.id }).where(eq(memberships.id, membershipId));
    return ok(undefined);
  });
}

export async function removeMember(
  actorUserId: string,
  companyId: string,
  membershipId: string,
  db: Db = getDb(),
): Promise<Result<void>> {
  const actorRole = await getMemberRole(actorUserId, companyId, db);
  const manager = await assertManager(actorUserId, companyId, db);
  if (!manager.ok) return manager;

  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ roleKey: roles.key, status: memberships.status })
      .from(memberships)
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(and(eq(memberships.id, membershipId), eq(memberships.companyId, companyId)))
      .for('update', { of: memberships });
    if (!target || target.status !== 'active') return err('NOT_FOUND', 'member not found');
    if (target.roleKey === 'owner') {
      if (actorRole !== 'owner') return err('FORBIDDEN', 'only owners manage owners');
      const owners = await lockOwners(tx, companyId);
      if (owners <= 1) return err('STATE', 'cannot remove the last owner', { reason: 'last_owner' });
    }
    await tx.update(memberships).set({ status: 'left' }).where(eq(memberships.id, membershipId));
    return ok(undefined);
  });
}

/** Locks the active owner memberships of the company and returns how many there are. */
async function lockOwners(tx: Parameters<Parameters<Db['transaction']>[0]>[0], companyId: string): Promise<number> {
  const rows = await tx
    .select({ id: memberships.id })
    .from(memberships)
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .where(
      and(
        eq(memberships.companyId, companyId),
        eq(memberships.status, 'active'),
        eq(roles.key, 'owner'),
      ),
    )
    .for('update', { of: memberships });
  return rows.length;
}
