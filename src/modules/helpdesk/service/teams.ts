import { asc, eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { helpdeskTeams, type HelpdeskTeam } from '../schema';

export const teamInput = z.object({ name: z.string().trim().min(1).max(120) });
export type TeamInput = z.infer<typeof teamInput>;

export async function createTeam(ctx: Ctx, input: TeamInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'helpdesk.team.write');
  if (!perm.ok) return perm;
  const [row] = await ctx.tx
    .insert(helpdeskTeams)
    .values({ companyId: ctx.companyId, createdBy: ctx.userId, name: input.name, active: true })
    .returning({ id: helpdeskTeams.id });
  if (!row) return err('INTERNAL', 'Insert failed');
  await audit(ctx, { action: 'create', entity: 'helpdesk.team', recordId: row.id, after: { name: input.name } });
  return ok({ id: row.id });
}

export async function listTeams(ctx: Ctx): Promise<Result<HelpdeskTeam[]>> {
  const perm = requirePerm(ctx, 'helpdesk.team.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select()
    .from(helpdeskTeams)
    .where(and(eq(helpdeskTeams.companyId, ctx.companyId), eq(helpdeskTeams.active, true)))
    .orderBy(asc(helpdeskTeams.name));
  return ok(rows);
}
