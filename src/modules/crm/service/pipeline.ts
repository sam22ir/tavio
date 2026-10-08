import { and, asc, eq } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { audit } from '@/core/audit';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { DEFAULT_PIPELINE, pipelines, stages } from '../schema';

export interface StageSummary {
  id: string;
  name: string;
  position: number;
  probability: number;
  isWon: boolean;
  fold: boolean;
}

async function findDefaultPipelineId(ctx: Ctx): Promise<string | null> {
  const [row] = await ctx.tx
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(and(eq(pipelines.companyId, ctx.companyId), eq(pipelines.isDefault, true)))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Returns the company's default pipeline, creating it with DEFAULT_PIPELINE stages on first use.
 * Idempotent: a second call returns the same id with created = false.
 */
export async function ensureDefaultPipeline(ctx: Ctx): Promise<Result<{ id: string; created: boolean }>> {
  const perm = requirePerm(ctx, 'crm.lead.read');
  if (!perm.ok) return perm;

  const existing = await findDefaultPipelineId(ctx);
  if (existing) return ok({ id: existing, created: false });

  // Unique indexes on (company_id, name) and (company_id) where is_default make a racing insert a no-op.
  const [inserted] = await ctx.tx
    .insert(pipelines)
    .values({ companyId: ctx.companyId, name: DEFAULT_PIPELINE.name, isDefault: true, createdBy: ctx.userId })
    .onConflictDoNothing()
    .returning({ id: pipelines.id });

  const pipelineId = inserted?.id ?? (await findDefaultPipelineId(ctx));
  if (!pipelineId) return err('CONFLICT', 'Default pipeline could not be created');
  if (!inserted) return ok({ id: pipelineId, created: false });

  await ctx.tx.insert(stages).values(
    DEFAULT_PIPELINE.stages.map((s) => ({
      companyId: ctx.companyId,
      pipelineId,
      name: s.names[ctx.locale],
      position: s.position,
      probability: s.probability,
      isWon: s.isWon,
      createdBy: ctx.userId,
    })),
  );

  await audit(ctx, {
    entity: 'crm.pipeline',
    recordId: pipelineId,
    action: 'create',
    after: { name: DEFAULT_PIPELINE.name, stages: DEFAULT_PIPELINE.stages.length },
  });
  return ok({ id: pipelineId, created: true });
}

/** Stages of a pipeline in position order. Empty when the pipeline is not in this company. */
export async function listStages(ctx: Ctx, pipelineId: string): Promise<Result<StageSummary[]>> {
  const perm = requirePerm(ctx, 'crm.lead.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select({
      id: stages.id,
      name: stages.name,
      position: stages.position,
      probability: stages.probability,
      isWon: stages.isWon,
      fold: stages.fold,
    })
    .from(stages)
    .where(and(eq(stages.companyId, ctx.companyId), eq(stages.pipelineId, pipelineId)))
    .orderBy(asc(stages.position));
  return ok(rows);
}
