import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { getDb } from '@/core/db/client';
import {
  companies,
  companyModules,
  invitations,
  memberships,
  rolePermissions,
  roles,
  users,
} from '@/core/db/schema';
import { activityTypes } from '@/modules/chatter/schema';
import { createCompany, loadTenantArgs } from '../service';
import {
  INVITE_HOURLY_LIMIT,
  acceptInvitation,
  createInvitation,
  getInvitationPreview,
  listInvitations,
  resendInvitation,
} from '../invitations';
import { changeRole, getMemberRole, listMembers, removeMember } from '../members';

loadDevEnv();

const db = getDb();
const runId = randomUUID();
const ownerId = randomUUID();
const inviteeId = randomUUID();
const strangerId = randomUUID();
const ownerId2 = randomUUID();
const companyIds: string[] = [];

afterAll(async () => {
  if (companyIds.length > 0) {
    await db.delete(invitations).where(inArray(invitations.companyId, companyIds));
    await db.delete(activityTypes).where(inArray(activityTypes.companyId, companyIds));
    await db.delete(rolePermissions).where(inArray(rolePermissions.companyId, companyIds));
    await db.delete(memberships).where(inArray(memberships.companyId, companyIds));
    await db.delete(companyModules).where(inArray(companyModules.companyId, companyIds));
    await db.delete(roles).where(inArray(roles.companyId, companyIds));
    await db.delete(companies).where(inArray(companies.id, companyIds));
  }
  await db.delete(users).where(inArray(users.id, [ownerId, inviteeId, strangerId, ownerId2]));
});

describe.skipIf(!process.env.TAVIO_W5_DB)('team invitations (database)', () => {
  it('invite, accept, wrong-email refusal and last-owner protection', async () => {
    await db.insert(users).values([
      { id: ownerId, name: 'Owner', email: `owner-${runId}@example.test` },
      { id: inviteeId, name: 'Invitee', email: `invitee-${runId}@example.test` },
      { id: strangerId, name: 'Stranger', email: `stranger-${runId}@example.test` },
    ]);
    const created = await createCompany(ownerId, { legalName: `Team ${runId.slice(0, 8)} SARL` }, db);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const companyId = created.value.companyId;
    companyIds.push(companyId);

    const invite = await createInvitation(ownerId, companyId, { email: `Invitee-${runId}@example.test`, roleKey: 'staff', locale: 'en', baseUrl: 'https://tavio.test' }, db);
    expect(invite.ok).toBe(true);
    if (!invite.ok) return;
    expect(invite.value.url).toBe(`https://tavio.test/en/invite/${invite.value.token}`);

    const preview = await getInvitationPreview(invite.value.token, db);
    expect(preview.ok && preview.value.state).toBe('open');

    const wrong = await acceptInvitation(strangerId, invite.value.token, db);
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error.code).toBe('FORBIDDEN');

    const accepted = await acceptInvitation(inviteeId, invite.value.token, db);
    expect(accepted.ok).toBe(true);
    expect(await getMemberRole(inviteeId, companyId, db)).toBe('staff');

    const again = await acceptInvitation(inviteeId, invite.value.token, db);
    expect(again.ok).toBe(false);

    const members = await listMembers(companyId, db);
    expect(members.map((m) => m.userId).sort()).toEqual([ownerId, inviteeId].sort());

    const ownerMembership = members.find((m) => m.userId === ownerId);
    expect(ownerMembership).toBeDefined();
    const demote = await changeRole(ownerId, companyId, ownerMembership!.membershipId, 'admin', db);
    expect(demote.ok).toBe(false);
    if (!demote.ok) expect(demote.error.details?.reason).toBe('last_owner');

    const removeOwner = await removeMember(ownerId, companyId, ownerMembership!.membershipId, db);
    expect(removeOwner.ok).toBe(false);

    const scope = await loadTenantArgs(inviteeId, companyId, 'en', db);
    expect(scope.ok).toBe(true);
  });

  it('re-invites after expiry, resends with a fresh token, and rate limits', async () => {
    await db.insert(users).values({ id: ownerId2, name: 'Owner2', email: `owner2-${runId}@example.test` });
    const created = await createCompany(ownerId2, { legalName: `Resend ${runId.slice(0, 8)} SARL` }, db);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const companyId = created.value.companyId;
    companyIds.push(companyId);
    const email = `late-${runId}@example.test`;

    const first = await createInvitation(ownerId2, companyId, { email, roleKey: 'staff' }, db);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    await db.update(invitations).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invitations.id, first.value.id));

    const listed = await listInvitations(ownerId2, companyId, db);
    expect(listed.ok && listed.value.find((i) => i.id === first.value.id)?.expired).toBe(true);

    const again = await createInvitation(ownerId2, companyId, { email, roleKey: 'staff' }, db);
    expect(again.ok).toBe(true);
    if (!again.ok) return;

    const resent = await resendInvitation(ownerId2, companyId, again.value.id, {}, db);
    expect(resent.ok).toBe(true);
    if (!resent.ok) return;
    expect(resent.value.token).not.toBe(again.value.token);
    const old = await getInvitationPreview(again.value.token, db);
    expect(old.ok && old.value.state).toBe('revoked');
    const fresh = await getInvitationPreview(resent.value.token, db);
    expect(fresh.ok && fresh.value.state).toBe('open');

    // Seed the rest of the hourly quota directly: going through the service 30 times is slow on a remote database.
    const used = 3; // expired, replacement and resent invitations (revoked rows still count)
    await db.insert(invitations).values(
      Array.from({ length: INVITE_HOURLY_LIMIT - used - 1 }, (_, i) => ({
        companyId,
        email: `bulk${i}-${runId}@example.test`,
        roleKey: 'staff',
        tokenHash: `bulk-${runId}-${i}`,
        expiresAt: new Date(Date.now() + 86_400_000),
        invitedBy: ownerId2,
      })),
    );
    const last = await createInvitation(ownerId2, companyId, { email: `last-${runId}@example.test`, roleKey: 'staff' }, db);
    expect(last.ok).toBe(true);
    const blocked = await createInvitation(ownerId2, companyId, { email: `over-${runId}@example.test`, roleKey: 'staff' }, db);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.details?.reason).toBe('rate_limited');
  });
});
