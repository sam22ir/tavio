import { and, asc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { Ctx } from '@/core/ctx';
import { audit } from '@/core/audit';
import type { Tx } from '@/core/db/types';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { crmSettings, leads, salesTeamMembers, salesTeams } from '../schema';

export type LeadScopeMode = 'all' | 'team' | 'own';

/**
 * Which leads a user may see. `view_all` sees everything, `view_team` sees the team's leads too,
 * and everyone else sees only their own leads. Team leaders see their team's leads in every mode.
 */
export function leadScopeMode(perms: ReadonlySet<string>): LeadScopeMode {
  // '*' is held by the owner and admin roles (default-roles.ts), so they see every lead.
  if (perms.has('*') || perms.has('crm.leads.view_all')) return 'all';
  if (perms.has('crm.leads.view_team')) return 'team';
  return 'own';
}

/** Whether the company restricts lead visibility. Off unless a settings row turns it on. */
export async function isLeadVisibilityRestricted(tx: Tx, companyId: string): Promise<boolean> {
  const [row] = await tx
    .select({ restricted: crmSettings.restrictLeadVisibility })
    .from(crmSettings)
    .where(eq(crmSettings.companyId, companyId))
    .limit(1);
  return row?.restricted ?? false;
}

/**
 * SQL restricting leads to what the ctx user may see. Undefined when the company does not restrict
 * visibility (every crm.lead.read user sees all leads) or when the user holds view_all.
 */
export async function leadScope(ctx: Ctx): Promise<SQL | undefined> {
  if (!(await isLeadVisibilityRestricted(ctx.tx, ctx.companyId))) return undefined;
  const mode = leadScopeMode(ctx.perms);
  if (mode === 'all') return undefined;

  const conds: SQL[] = [
    eq(leads.salespersonId, ctx.userId),
    eq(leads.createdBy, ctx.userId),
    inArray(
      leads.teamId,
      ctx.tx
        .select({ id: salesTeams.id })
        .from(salesTeams)
        .where(and(eq(salesTeams.companyId, ctx.companyId), eq(salesTeams.leaderId, ctx.userId))),
    ),
  ];
  if (mode === 'team') {
    conds.push(
      inArray(
        leads.teamId,
        ctx.tx
          .select({ id: salesTeamMembers.teamId })
          .from(salesTeamMembers)
          .where(and(eq(salesTeamMembers.companyId, ctx.companyId), eq(salesTeamMembers.userId, ctx.userId))),
      ),
    );
  }
  return or(...conds);
}

/** The team a user belongs to, or null. Used as the default team of their leads. */
export async function teamIdForUser(tx: Tx, companyId: string, userId: string): Promise<string | null> {
  const [row] = await tx
    .select({ teamId: salesTeamMembers.teamId })
    .from(salesTeamMembers)
    .where(and(eq(salesTeamMembers.companyId, companyId), eq(salesTeamMembers.userId, userId)))
    .limit(1);
  return row?.teamId ?? null;
}

export async function getLeadVisibilityRestriction(ctx: Ctx): Promise<Result<{ restricted: boolean }>> {
  const perm = requirePerm(ctx, 'crm.lead.read');
  if (!perm.ok) return perm;
  return ok({ restricted: await isLeadVisibilityRestricted(ctx.tx, ctx.companyId) });
}

/** Turns lead visibility restriction on or off for the company. Off is the default. */
export async function setLeadVisibilityRestriction(ctx: Ctx, restricted: boolean): Promise<Result<{ restricted: boolean }>> {
  const perm = requirePerm(ctx, 'crm.lead.write');
  if (!perm.ok) return perm;
  const before = await isLeadVisibilityRestricted(ctx.tx, ctx.companyId);
  await ctx.tx
    .insert(crmSettings)
    .values({ companyId: ctx.companyId, restrictLeadVisibility: restricted, createdBy: ctx.userId })
    .onConflictDoUpdate({
      target: crmSettings.companyId,
      set: { restrictLeadVisibility: restricted, updatedAt: new Date() },
    });
  await audit(ctx, {
    entity: 'crm.settings',
    recordId: ctx.companyId,
    action: 'update',
    before: { restrictLeadVisibility: before },
    after: { restrictLeadVisibility: restricted },
  });
  return ok({ restricted });
}

export interface TeamRow {
  id: string;
  name: string;
  leaderId: string | null;
  memberIds: string[];
}

export interface MemberOption {
  userId: string;
  name: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Active members of the company, from the tenant-scoped member_directory view (users is not readable by the app role). */
export async function listMemberOptions(ctx: Ctx): Promise<Result<MemberOption[]>> {
  const perm = requirePerm(ctx, 'crm.lead.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select({ userId: sql<string>`member_directory.user_id`, name: sql<string>`member_directory.name` })
    .from(sql`member_directory`)
    .where(sql`member_directory.company_id = ${ctx.companyId} and member_directory.status = 'active'`)
    .orderBy(asc(sql`member_directory.name`));
  return ok(rows);
}

export async function listTeams(ctx: Ctx): Promise<Result<TeamRow[]>> {
  const perm = requirePerm(ctx, 'crm.lead.read');
  if (!perm.ok) return perm;
  const teams = await ctx.tx
    .select({ id: salesTeams.id, name: salesTeams.name, leaderId: salesTeams.leaderId })
    .from(salesTeams)
    .where(eq(salesTeams.companyId, ctx.companyId))
    .orderBy(asc(salesTeams.name));
  const members = await ctx.tx
    .select({ teamId: salesTeamMembers.teamId, userId: salesTeamMembers.userId })
    .from(salesTeamMembers)
    .where(eq(salesTeamMembers.companyId, ctx.companyId));
  return ok(
    teams.map((t) => ({
      ...t,
      memberIds: members.filter((m) => m.teamId === t.id).map((m) => m.userId),
    })),
  );
}

export const saveTeamInput = z.object({
  id: z.string().regex(UUID_RE).optional(),
  name: z.string().trim().min(1).max(120),
  leaderId: z.string().regex(UUID_RE).nullish(),
  userIds: z.array(z.string().regex(UUID_RE)).default([]),
});
export type SaveTeamInput = z.input<typeof saveTeamInput>;

/**
 * Creates a team when `id` is absent, otherwise updates it. Sets the member list: a user moved here
 * leaves the team they were in, because a user belongs to one team per company. The leader and
 * every member must be active company members.
 */
export async function saveTeam(ctx: Ctx, input: SaveTeamInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'crm.lead.write');
  if (!perm.ok) return perm;
  const parsed = saveTeamInput.safeParse(input);
  if (!parsed.success) return err('VALIDATION', 'Invalid team', { issues: parsed.error.issues });
  const data = parsed.data;
  const userIds = [...new Set(data.userIds)];

  const members = await listMemberOptions(ctx);
  if (!members.ok) return members;
  const memberSet = new Set(members.value.map((m) => m.userId));
  if (userIds.some((u) => !memberSet.has(u))) return err('VALIDATION', 'Unknown team member');
  if (data.leaderId && !memberSet.has(data.leaderId)) return err('VALIDATION', 'Unknown team leader');

  const [sameName] = await ctx.tx
    .select({ id: salesTeams.id })
    .from(salesTeams)
    .where(and(eq(salesTeams.companyId, ctx.companyId), eq(salesTeams.name, data.name)));
  if (sameName && sameName.id !== data.id) return err('CONFLICT', 'A team with this name already exists');

  let teamId = data.id;
  let previousMemberIds: string[] = [];
  if (teamId) {
    const [before] = await ctx.tx
      .select({ name: salesTeams.name, leaderId: salesTeams.leaderId })
      .from(salesTeams)
      .where(and(eq(salesTeams.companyId, ctx.companyId), eq(salesTeams.id, teamId)))
      .for('update');
    if (!before) return err('NOT_FOUND', 'Team not found');
    previousMemberIds = (
      await ctx.tx
        .select({ userId: salesTeamMembers.userId })
        .from(salesTeamMembers)
        .where(and(eq(salesTeamMembers.companyId, ctx.companyId), eq(salesTeamMembers.teamId, teamId)))
    ).map((m) => m.userId);
    await ctx.tx
      .update(salesTeams)
      .set({ name: data.name, leaderId: data.leaderId ?? null, updatedAt: new Date() })
      .where(eq(salesTeams.id, teamId));
    await audit(ctx, {
      entity: 'crm.sales_team',
      recordId: teamId,
      action: 'update',
      before: { name: before.name, leaderId: before.leaderId },
      after: { name: data.name, leaderId: data.leaderId ?? null },
    });
  } else {
    const [row] = await ctx.tx
      .insert(salesTeams)
      .values({ companyId: ctx.companyId, name: data.name, leaderId: data.leaderId ?? null, createdBy: ctx.userId })
      .returning({ id: salesTeams.id });
    if (!row) return err('INTERNAL', 'Team insert returned no row');
    teamId = row.id;
    await audit(ctx, { entity: 'crm.sales_team', recordId: teamId, action: 'create', after: { name: data.name } });
  }

  await ctx.tx
    .delete(salesTeamMembers)
    .where(
      and(
        eq(salesTeamMembers.companyId, ctx.companyId),
        eq(salesTeamMembers.teamId, teamId),
        userIds.length ? sql`${salesTeamMembers.userId} not in (${sql.join(userIds.map((u) => sql`${u}`), sql`, `)})` : sql`true`,
      ),
    );
  if (userIds.length) {
    await ctx.tx
      .delete(salesTeamMembers)
      .where(
        and(
          eq(salesTeamMembers.companyId, ctx.companyId),
          inArray(salesTeamMembers.userId, userIds),
          sql`${salesTeamMembers.teamId} <> ${teamId}`,
        ),
      );
    await ctx.tx
      .insert(salesTeamMembers)
      .values(userIds.map((userId) => ({ companyId: ctx.companyId, teamId: savedTeamId, userId, createdBy: ctx.userId })))
      .onConflictDoNothing();
  }

  const savedTeamId: string = teamId;
  // Leads follow their salesperson's team. Open leads of newly added members move here.
  // Leads of removed members that pointed at this team move to the team they now belong to, or to none.
  const added = userIds.filter((u) => !previousMemberIds.includes(u));
  const removed = previousMemberIds.filter((u) => !userIds.includes(u));
  if (added.length) {
    await ctx.tx
      .update(leads)
      .set({ teamId: savedTeamId, updatedAt: new Date() })
      .where(
        and(
          eq(leads.companyId, ctx.companyId),
          eq(leads.status, 'open'),
          inArray(leads.salespersonId, added),
        ),
      );
  }
  for (const userId of removed) {
    const newTeamId = await teamIdForUser(ctx.tx, ctx.companyId, userId);
    await ctx.tx
      .update(leads)
      .set({ teamId: newTeamId, updatedAt: new Date() })
      .where(
        and(
          eq(leads.companyId, ctx.companyId),
          eq(leads.teamId, savedTeamId),
          eq(leads.salespersonId, userId),
        ),
      );
  }
  return ok({ id: teamId });
}
