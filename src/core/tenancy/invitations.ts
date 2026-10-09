// Team invitations (W6-B). Runs on the owner connection with explicit company checks, like service.ts.
import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/core/db/client';
import { companies, invitations, memberships, roles, users } from '@/core/db/schema';
import type { Db } from '@/core/db/types';
import type { Locale } from '@/core/ctx';
import { err, ok, type Result } from '@/core/result';
import { emailConfigured, sendEmail } from '@/core/adapters/email';
import { invitationEmail } from '@/core/auth/emails';
import { canManageTeam, getMemberRole, isMemberRoleKey } from './members';

export const INVITE_TTL_DAYS = 7;
export const INVITABLE_ROLE_KEYS = ['admin', 'manager', 'staff'] as const;
export type InvitableRoleKey = (typeof INVITABLE_ROLE_KEYS)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CreateInvitationInput {
  email: string;
  roleKey: string;
  /** Locale of the invitation email and link. Defaults to fr. */
  locale?: Locale;
  /** Public origin for the link. Defaults to BETTER_AUTH_URL. */
  baseUrl?: string;
}

export interface CreatedInvitation {
  id: string;
  url: string;
  token: string;
  emailSent: boolean;
  expiresAt: Date;
}

export interface InvitationRow {
  id: string;
  email: string;
  roleKey: string;
  expiresAt: Date;
}

export type InvitationState = 'open' | 'expired' | 'revoked' | 'accepted';

export interface InvitationPreview {
  companyId: string;
  companyName: string;
  email: string;
  roleKey: string;
  state: InvitationState;
}

/** Random token shown once in the link. */
export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hex of the token. Only the hash is stored. */
export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function inviteExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function isInviteExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isInvitableRole(value: string): value is InvitableRoleKey {
  return (INVITABLE_ROLE_KEYS as readonly string[]).includes(value);
}

/** True when outgoing email is configured. Never throws. */
export function invitationEmailEnabled(): boolean {
  try {
    return emailConfigured();
  } catch {
    return false;
  }
}

/** Sends the invitation email when Resend is configured. Never throws. */
async function trySendInvitationEmail(args: {
  to: string;
  locale: Locale;
  companyName: string;
  inviterName: string;
  url: string;
}): Promise<boolean> {
  try {
    if (!emailConfigured()) return false;
    const message = invitationEmail({
      locale: args.locale,
      companyName: args.companyName,
      inviterName: args.inviterName,
      url: args.url,
    });
    const result = await sendEmail({ ...message, to: args.to });
    return result.sent;
  } catch {
    return false;
  }
}

export async function createInvitation(
  userId: string,
  companyId: string,
  input: CreateInvitationInput,
  db: Db = getDb(),
): Promise<Result<CreatedInvitation>> {
  const email = normalizeInviteEmail(input.email);
  if (!EMAIL_RE.test(email)) return err('VALIDATION', 'invalid email');
  if (!isInvitableRole(input.roleKey)) return err('VALIDATION', 'role cannot be invited');
  const roleKey = input.roleKey;

  const inviterRole = await getMemberRole(userId, companyId, db);
  if (!canManageTeam(inviterRole)) return err('FORBIDDEN', 'only owners and admins can invite');

  const [member] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        eq(memberships.companyId, companyId),
        sql`${memberships.status} in ('active', 'suspended')`,
        sql`lower(${users.email}) = ${email}`,
      ),
    )
    .limit(1);
  if (member) return err('CONFLICT', 'already a member', { reason: 'already_member' });

  const [pending] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      and(
        eq(invitations.companyId, companyId),
        eq(invitations.email, email),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
      ),
    )
    .limit(1);
  if (pending) return err('CONFLICT', 'already invited', { reason: 'already_invited' });

  const [company] = await db
    .select({ name: companies.displayName })
    .from(companies)
    .where(eq(companies.id, companyId));
  const [inviter] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  if (!company) return err('NOT_FOUND', 'company not found');

  const token = generateInviteToken();
  const expiresAt = inviteExpiry();
  let id: string;
  try {
    const [row] = await db
      .insert(invitations)
      .values({
        companyId,
        email,
        roleKey,
        tokenHash: hashInviteToken(token),
        expiresAt,
        invitedBy: userId,
      })
      .returning({ id: invitations.id });
    if (!row) return err('INTERNAL', 'invitation insert returned no row');
    id = row.id;
  } catch {
    return err('CONFLICT', 'already invited', { reason: 'already_invited' });
  }

  const locale: Locale = input.locale ?? 'fr';
  const origin = (input.baseUrl ?? process.env.BETTER_AUTH_URL ?? '').replace(/\/+$/, '');
  const url = `${origin}/${locale}/invite/${token}`;
  const emailSent = await trySendInvitationEmail({
    to: email,
    locale,
    companyName: company.name,
    inviterName: inviter?.name ?? company.name,
    url,
  });
  return ok({ id, url, token, emailSent, expiresAt });
}

export async function listInvitations(
  userId: string,
  companyId: string,
  db: Db = getDb(),
): Promise<Result<InvitationRow[]>> {
  const role = await getMemberRole(userId, companyId, db);
  if (!canManageTeam(role)) return err('FORBIDDEN', 'only owners and admins can view invitations');
  const rows = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      roleKey: invitations.roleKey,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.companyId, companyId),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(invitations.createdAt));
  return ok(rows);
}

export async function revokeInvitation(
  userId: string,
  companyId: string,
  invitationId: string,
  db: Db = getDb(),
): Promise<Result<void>> {
  const role = await getMemberRole(userId, companyId, db);
  if (!canManageTeam(role)) return err('FORBIDDEN', 'only owners and admins can revoke invitations');
  const updated = await db
    .update(invitations)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.companyId, companyId),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
      ),
    )
    .returning({ id: invitations.id });
  if (updated.length === 0) return err('NOT_FOUND', 'invitation not found');
  return ok(undefined);
}

function stateOf(row: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }): InvitationState {
  if (row.acceptedAt) return 'accepted';
  if (row.revokedAt) return 'revoked';
  if (isInviteExpired(row.expiresAt)) return 'expired';
  return 'open';
}

/** Public view of an invitation for the /invite/[token] page. The token itself is the secret. */
export async function getInvitationPreview(token: string, db: Db = getDb()): Promise<Result<InvitationPreview>> {
  const [row] = await db
    .select({
      companyId: invitations.companyId,
      companyName: companies.displayName,
      email: invitations.email,
      roleKey: invitations.roleKey,
      acceptedAt: invitations.acceptedAt,
      revokedAt: invitations.revokedAt,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .innerJoin(companies, eq(companies.id, invitations.companyId))
    .where(eq(invitations.tokenHash, hashInviteToken(token)));
  if (!row) return err('NOT_FOUND', 'invitation not found');
  return ok({
    companyId: row.companyId,
    companyName: row.companyName,
    email: row.email,
    roleKey: row.roleKey,
    state: stateOf(row),
  });
}

/**
 * Accepts an invitation for the signed-in user. The user's email must match the invitation email.
 * Creates the membership with the invited role, or reactivates a former (left) membership.
 */
export async function acceptInvitation(
  userId: string,
  token: string,
  db: Db = getDb(),
): Promise<Result<{ companyId: string }>> {
  return db.transaction(async (tx) => {
    const [inv] = await tx
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, hashInviteToken(token)))
      .for('update');
    if (!inv) return err('NOT_FOUND', 'invitation not found');
    const state = stateOf(inv);
    if (state === 'accepted') return err('CONFLICT', 'invitation already accepted', { reason: 'accepted' });
    if (state !== 'open') return err('STATE', `invitation is ${state}`, { reason: state });

    const [user] = await tx.select({ email: users.email }).from(users).where(eq(users.id, userId));
    if (!user) return err('UNAUTHENTICATED', 'no such user');
    if (normalizeInviteEmail(user.email) !== inv.email) {
      return err('FORBIDDEN', 'this invitation was sent to another email', { reason: 'wrong_email' });
    }

    const [role] = await tx
      .select({ id: roles.id, key: roles.key })
      .from(roles)
      .where(and(eq(roles.companyId, inv.companyId), eq(roles.key, inv.roleKey)));
    if (!role || !isMemberRoleKey(role.key)) return err('NOT_FOUND', 'role not found');

    const now = new Date();
    const [existing] = await tx
      .select({ id: memberships.id, status: memberships.status })
      .from(memberships)
      .where(and(eq(memberships.companyId, inv.companyId), eq(memberships.userId, userId)))
      .for('update');
    if (existing?.status === 'active') return err('CONFLICT', 'already a member', { reason: 'already_member' });
    if (existing) {
      await tx
        .update(memberships)
        .set({ roleId: role.id, status: 'active', joinedAt: now, invitedEmail: null, inviteTokenHash: null, inviteExpiresAt: null })
        .where(eq(memberships.id, existing.id));
    } else {
      await tx.insert(memberships).values({
        companyId: inv.companyId,
        userId,
        roleId: role.id,
        status: 'active',
        joinedAt: now,
        createdBy: userId,
      });
    }

    await tx
      .update(invitations)
      .set({ acceptedAt: now, acceptedBy: userId })
      .where(eq(invitations.id, inv.id));
    return ok({ companyId: inv.companyId });
  });
}
