import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Ctx } from '@/core/ctx';
import { audit } from '@/core/audit';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { lostReasons } from '../schema';

export const lostReasonInput = z.object({ name: z.string().trim().min(1).max(120) });
export type LostReasonInput = z.infer<typeof lostReasonInput>;

export interface LostReasonRow {
  id: string;
  name: string;
}

/** Active lost reasons, sorted by name. */
export async function listLostReasons(ctx: Ctx): Promise<Result<LostReasonRow[]>> {
  const perm = requirePerm(ctx, 'crm.lead.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select({ id: lostReasons.id, name: lostReasons.name })
    .from(lostReasons)
    .where(and(eq(lostReasons.companyId, ctx.companyId), eq(lostReasons.active, true)))
    .orderBy(asc(lostReasons.name));
  return ok(rows);
}

export async function createLostReason(ctx: Ctx, input: LostReasonInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'crm.lead.write');
  if (!perm.ok) return perm;
  const parsed = lostReasonInput.safeParse(input);
  if (!parsed.success) return err('VALIDATION', 'Invalid lost reason', { issues: parsed.error.issues.length });

  const [inserted] = await ctx.tx
    .insert(lostReasons)
    .values({ companyId: ctx.companyId, name: parsed.data.name, createdBy: ctx.userId })
    .onConflictDoNothing()
    .returning({ id: lostReasons.id });
  if (!inserted) return err('CONFLICT', 'A lost reason with this name already exists');

  await audit(ctx, {
    entity: 'crm.lost_reason',
    recordId: inserted.id,
    action: 'create',
    after: { name: parsed.data.name },
  });
  return ok({ id: inserted.id });
}
