import { and, eq } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import * as chatter from '@/modules/chatter/service';
import type { RuleInput } from '@/modules/automation/service/rules';
import { companyModules } from '@/core/db/schema/tenancy';
import { audit } from '@/core/audit';
import { listDocumentRequirements, saveDocumentRequirement } from '@/modules/credit_sales/service/documents';
import { lostReasons } from '../schema';
import * as crm from '../service';
import {
  MOURABAHA_ACTIVITY_TYPES,
  MOURABAHA_DOCUMENT_REQUIREMENTS,
  MOURABAHA_LOST_REASONS,
  MOURABAHA_PIPELINE_NAME,
  MOURABAHA_PLANS,
  MOURABAHA_STAGES,
} from './mourabaha';

// Stage name to the plan code launched when a lead enters that stage (item 23). Other stages only cancel plans.
const PLAN_CODE_BY_STAGE: Readonly<Record<string, string>> = {
  'Ne répond pas': 'NR',
  Injoignable: 'INJ',
  "Demande d'information": 'INFO',
  Qualifié: 'QUAL',
  Intéressé: 'INT',
  'Orienté showroom': 'SHOW',
  "En attente de l'envoi du dossier": 'DOS',
};

const LEAD_ENTITY = 'crm.lead';
const CANCEL_ACTION = { entity: LEAD_ENTITY, recordIdField: 'leadId' } as const;

export type MourabahaSkippedStep = 'automation' | 'documents';

export interface MourabahaTemplateResult {
  pipelineId: string;
  stages: number;
  plans: number;
  rules: number;
  /** Steps that were skipped because of a missing permission or a disabled module. */
  skipped: MourabahaSkippedStep[];
}

/**
 * Creates the Mourabaha pipeline, lost reasons, activity types, activity plans, automation rules and
 * default document requirements. Safe to run again: every record is found by name and updated in place.
 */
export async function applyMourabahaTemplate(ctx: Ctx): Promise<Result<MourabahaTemplateResult>> {
  const perm = requirePerm(ctx, 'crm.lead.write');
  if (!perm.ok) return perm;

  const pipeline = await crm.createPipeline(ctx, MOURABAHA_PIPELINE_NAME);
  if (!pipeline.ok) return pipeline;
  const pipelineId = pipeline.value.id;

  // Stages, in kanban order (item 8). Each is matched by name so a re-run updates instead of duplicating.
  const existingStages = await crm.listStages(ctx, pipelineId);
  if (!existingStages.ok) return existingStages;
  const stageIds = new Map<string, string>();
  for (const [position, tpl] of MOURABAHA_STAGES.entries()) {
    const found = existingStages.value.find((s) => s.name === tpl.name);
    const saved = await crm.saveStage(ctx, {
      pipelineId,
      id: found?.id,
      name: tpl.name,
      position,
      probability: tpl.probability,
      isWon: tpl.isWon,
      fold: tpl.fold,
      requirements: tpl.requirements,
    });
    if (!saved.ok) return saved;
    stageIds.set(tpl.name, saved.value.id);
  }

  // Includes inactive reasons: a match is reactivated rather than duplicated.
  const existingReasons = await ctx.tx
    .select({ id: lostReasons.id, name: lostReasons.name, active: lostReasons.active })
    .from(lostReasons)
    .where(eq(lostReasons.companyId, ctx.companyId));
  for (const name of MOURABAHA_LOST_REASONS) {
    const found = existingReasons.find((r) => r.name === name);
    if (found?.active) continue;
    if (found) {
      await ctx.tx.update(lostReasons).set({ active: true }).where(eq(lostReasons.id, found.id));
      await audit(ctx, { entity: 'crm.lost_reason', recordId: found.id, action: 'update', before: { active: false }, after: { active: true } });
      continue;
    }
    const created = await crm.createLostReason(ctx, { name });
    if (!created.ok) return created;
  }

  const activityTypes = await chatter.listActivityTypes(ctx);
  const typeIds = new Map<string, string>();
  for (const t of MOURABAHA_ACTIVITY_TYPES) {
    const found = activityTypes.find((x) => x.name === t.name);
    if (found) {
      typeIds.set(t.key, found.id);
      continue;
    }
    const saved = await chatter.saveActivityType(ctx, {
      name: t.name,
      entity: LEAD_ENTITY,
      icon: null,
      delayCount: t.delayCount,
      delayUnit: 'days',
      category: t.category,
      chainingType: 'suggest',
      nextTypeId: null,
      defaultUserId: null,
      requireResult: t.requireResult,
      active: true,
    });
    if (!saved.ok) return saved;
    typeIds.set(t.key, saved.value.id);
  }

  const existingPlans = await chatter.listPlans(ctx);
  const planIds = new Map<string, string>();
  for (const p of MOURABAHA_PLANS) {
    const steps = [];
    for (const s of p.steps) {
      const activityTypeId = typeIds.get(s.activityTypeKey);
      if (!activityTypeId) return err('INTERNAL', `Missing activity type ${s.activityTypeKey}`);
      steps.push({ activityTypeId, summary: s.summary, offsetDays: s.offsetDays, responsible: 'record_owner' as const, userId: null });
    }
    const found = existingPlans.find((x) => x.plan.name === p.name);
    const saved = await chatter.savePlan(ctx, { id: found?.plan.id, name: p.name, entity: LEAD_ENTITY, active: true, steps });
    if (!saved.ok) return saved;
    planIds.set(p.code, saved.value.id);
  }

  const skipped: MourabahaSkippedStep[] = [];

  // Document requirements. Skipped (not failed) when the user lacks the credit_sales permission.
  const docs = await listDocumentRequirements(ctx);
  if (!docs.ok && docs.error.code === 'FORBIDDEN') {
    skipped.push('documents');
  } else if (!docs.ok) {
    return docs;
  } else {
    for (const name of MOURABAHA_DOCUMENT_REQUIREMENTS) {
      const found = docs.value.find((d) => d.name === name);
      if (found?.required && found.active) continue;
      const saved = await saveDocumentRequirement(ctx, { id: found?.id, name, required: true, active: true });
      if (!saved.ok && saved.error.code === 'FORBIDDEN') {
        skipped.push('documents');
        break;
      }
      if (!saved.ok) return saved;
    }
  }

  // Automation rules run only when the automation module is enabled for the company.
  // Loaded dynamically so CRM does not depend on automation.
  const [automationRow] = await ctx.tx
    .select({ enabled: companyModules.enabled })
    .from(companyModules)
    .where(and(eq(companyModules.companyId, ctx.companyId), eq(companyModules.moduleId, 'automation')))
    .limit(1);
  if (!automationRow?.enabled) {
    skipped.push('automation');
  } else {
    const rules = await applyRules(ctx, stageIds, planIds);
    if (!rules.ok) return rules;
    return ok({ pipelineId, stages: MOURABAHA_STAGES.length, plans: MOURABAHA_PLANS.length, rules: rules.value, skipped });
  }

  return ok({ pipelineId, stages: MOURABAHA_STAGES.length, plans: MOURABAHA_PLANS.length, rules: 0, skipped });
}

async function applyRules(
  ctx: Ctx,
  stageIds: ReadonlyMap<string, string>,
  planIds: ReadonlyMap<string, string>,
): Promise<Result<number>> {
  const { createRule, listRules, updateRule } = await import('@/modules/automation/service/rules');
  // Conditions are ANDed, so each stage gets its own rule on toStageId.
  const existingRules = await listRules(ctx);
  const upsertRule = async (name: string, raw: RuleInput): Promise<Result<{ id: string }>> => {
    const found = existingRules.find((r) => r.name === name);
    return found ? updateRule(ctx, found.id, raw) : createRule(ctx, raw);
  };

  let rules = 0;
  for (const tpl of MOURABAHA_STAGES) {
    const toStageId = stageIds.get(tpl.name);
    if (!toStageId) return err('INTERNAL', `Missing stage ${tpl.name}`);
    const planCode = PLAN_CODE_BY_STAGE[tpl.name];
    const planId = planCode ? planIds.get(planCode) : undefined;
    const common = {
      kind: 'event' as const,
      triggerEvent: 'crm.lead.stage_changed' as const,
      conditions: [{ field: 'toStageId', op: 'eq' as const, value: toStageId }],
      active: true,
    };
    const raw: RuleInput = planId
      ? {
          ...common,
          name: `Mourabaha: ${tpl.name}`,
          action: 'multi',
          actionConfig: {
            actions: [
              { action: 'cancel_activity_plans' as const, config: CANCEL_ACTION },
              { action: 'launch_activity_plan' as const, config: { ...CANCEL_ACTION, planId, cancelPrevious: true } },
            ],
          },
        }
      : { ...common, name: `Mourabaha: ${tpl.name}`, action: 'cancel_activity_plans', actionConfig: CANCEL_ACTION };
    const saved = await upsertRule(raw.name, raw);
    if (!saved.ok) return saved;
    rules += 1;
  }

  const answered: RuleInput = {
    kind: 'event',
    name: 'Mourabaha: client answered',
    triggerEvent: 'chatter.activity.done',
    conditions: [
      { field: 'result', op: 'eq', value: 'answered' },
      { field: 'entity', op: 'eq', value: LEAD_ENTITY },
    ],
    action: 'cancel_activity_plans',
    actionConfig: { entity: LEAD_ENTITY, recordIdField: 'recordId' },
    active: true,
  };
  const savedAnswered = await upsertRule(answered.name, answered);
  if (!savedAnswered.ok) return savedAnswered;
  rules += 1;

  return ok(rules);
}
