import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
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

function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && e.code === '23505';
}

export const pipelineNameInput = z.string().trim().min(1).max(120);

export const stageInput = z.object({
  pipelineId: z.uuid(),
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(120),
  position: z.number().int().min(0).max(10000),
  probability: z.number().int().min(0).max(100),
  isWon: z.boolean(),
  fold: z.boolean(),
  requirements: z.string().trim().max(1000).nullish(),
});
export interface StageSaveInput {
  pipelineId: string;
  id?: string;
  name: string;
  position: number;
  probability: number;
  isWon: boolean;
  fold: boolean;
  requirements?: string | null;
}

export interface PipelineRow {
  id: string;
  name: string;
  isDefault: boolean;
  active: boolean;
}

/** Pipelines of the company, sorted by name. */
export async function listPipelines(ctx: Ctx): Promise<Result<PipelineRow[]>> {
  const perm = requirePerm(ctx, 'crm.lead.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select({ id: pipelines.id, name: pipelines.name, isDefault: pipelines.isDefault, active: pipelines.active })
    .from(pipelines)
    .where(eq(pipelines.companyId, ctx.companyId))
    .orderBy(asc(pipelines.name));
  return ok(rows);
}

/** Creates a pipeline by name. Idempotent: an existing pipeline with the same name is returned with created = false. */
export async function createPipeline(ctx: Ctx, name: string): Promise<Result<{ id: string; created: boolean }>> {
  const perm = requirePerm(ctx, 'crm.lead.write');
  if (!perm.ok) return perm;
  const parsed = pipelineNameInput.safeParse(name);
  if (!parsed.success) return err('VALIDATION', 'Pipeline name must be 1 to 120 characters');

  const [existing] = await ctx.tx
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(and(eq(pipelines.companyId, ctx.companyId), eq(pipelines.name, parsed.data)))
    .limit(1);
  if (existing) return ok({ id: existing.id, created: false });

  const [inserted] = await ctx.tx
    .insert(pipelines)
    .values({ companyId: ctx.companyId, name: parsed.data, isDefault: false, createdBy: ctx.userId })
    .onConflictDoNothing()
    .returning({ id: pipelines.id });
  if (!inserted) return err('CONFLICT', 'Pipeline could not be created');

  await audit(ctx, { entity: 'crm.pipeline', recordId: inserted.id, action: 'create', after: { name: parsed.data } });
  return ok({ id: inserted.id, created: true });
}

/** Creates a stage (no id) or updates one (with id) in a pipeline of this company. */
export async function saveStage(ctx: Ctx, input: StageSaveInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'crm.lead.write');
  if (!perm.ok) return perm;
  const parsed = stageInput.safeParse(input);
  if (!parsed.success) return err('VALIDATION', 'Invalid stage', { issues: parsed.error.issues.length });
  const v = parsed.data;

  const [pipeline] = await ctx.tx
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(and(eq(pipelines.id, v.pipelineId), eq(pipelines.companyId, ctx.companyId)))
    .limit(1);
  if (!pipeline) return err('NOT_FOUND', 'Pipeline not found');

  const values = {
    name: v.name,
    position: v.position,
    probability: v.probability,
    isWon: v.isWon,
    fold: v.fold,
    requirements: v.requirements ?? null,
  };

  // A savepoint keeps the outer transaction usable after a unique violation (position or name clash).
  try {
    if (v.id) {
      const stageId = v.id;
      return await ctx.tx.transaction(async (sp) => {
        const [before] = await sp
          .select()
          .from(stages)
          .where(and(eq(stages.id, stageId), eq(stages.companyId, ctx.companyId), eq(stages.pipelineId, v.pipelineId)))
          .limit(1);
        if (!before) return err('NOT_FOUND', 'Stage not found');
        await sp.update(stages).set(values).where(eq(stages.id, stageId));
        await audit({ ...ctx, tx: sp }, { entity: 'crm.stage', recordId: stageId, action: 'update', before, after: values });
        return ok({ id: stageId });
      });
    }

    return await ctx.tx.transaction(async (sp) => {
      const [inserted] = await sp
        .insert(stages)
        .values({ companyId: ctx.companyId, pipelineId: v.pipelineId, ...values, createdBy: ctx.userId })
        .returning({ id: stages.id });
      if (!inserted) return err('CONFLICT', 'Stage could not be created');
      await audit({ ...ctx, tx: sp }, { entity: 'crm.stage', recordId: inserted.id, action: 'create', after: values });
      return ok({ id: inserted.id });
    });
  } catch (e) {
    if (isUniqueViolation(e)) return err('CONFLICT', 'A stage with this name or position already exists');
    throw e;
  }
}

/** Makes one pipeline the company default and demotes the previous default, in the caller's transaction. */
export async function setDefaultPipeline(ctx: Ctx, pipelineId: string): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'crm.lead.write');
  if (!perm.ok) return perm;
  const [target] = await ctx.tx
    .select({ id: pipelines.id, isDefault: pipelines.isDefault })
    .from(pipelines)
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.companyId, ctx.companyId)))
    .limit(1);
  if (!target) return err('NOT_FOUND', 'Pipeline not found');
  if (target.isDefault) return ok({ id: pipelineId });

  // Demote first: the partial unique index allows one default per company.
  await ctx.tx
    .update(pipelines)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(and(eq(pipelines.companyId, ctx.companyId), eq(pipelines.isDefault, true)));
  await ctx.tx
    .update(pipelines)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.companyId, ctx.companyId)));
  await audit(ctx, { entity: 'crm.pipeline', recordId: pipelineId, action: 'update', after: { isDefault: true } });
  return ok({ id: pipelineId });
}
