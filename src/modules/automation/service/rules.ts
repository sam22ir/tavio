import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { err, ok, type Result } from '@/core/result';
import { actionConfigSchemas, ACTION_NAMES, type ActionName } from '../config';
import { conditionsSchema, type Condition } from '../conditions';
import { TRIGGER_EVENTS } from '../engine';
import { automationRules, type AutomationRule } from '../schema';

export const ruleInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    triggerEvent: z.enum(TRIGGER_EVENTS),
    conditions: conditionsSchema,
    action: z.enum(ACTION_NAMES as [ActionName, ...ActionName[]]),
    actionConfig: z.record(z.string(), z.unknown()),
    active: z.boolean(),
  })
  .superRefine((v, c) => {
    const cfg = actionConfigSchemas[v.action].safeParse(v.actionConfig);
    if (!cfg.success) {
      c.addIssue({ code: 'custom', path: ['actionConfig'], message: 'Invalid action configuration' });
    }
  });
export type RuleInput = z.input<typeof ruleInput>;

export async function listRules(ctx: Ctx): Promise<AutomationRule[]> {
  return ctx.tx.select().from(automationRules).orderBy(asc(automationRules.name));
}

export async function createRule(ctx: Ctx, raw: RuleInput): Promise<Result<{ id: string }>> {
  const parsed = ruleInput.safeParse(raw);
  if (!parsed.success) return err('VALIDATION', 'Invalid rule');
  const input = parsed.data;
  const [row] = await ctx.tx
    .insert(automationRules)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      name: input.name,
      triggerEvent: input.triggerEvent,
      conditions: input.conditions as Condition[],
      action: input.action,
      actionConfig: input.actionConfig,
      active: input.active,
    })
    .returning({ id: automationRules.id });
  if (!row) return err('INTERNAL', 'Insert failed');
  await audit(ctx, { entity: 'automation.rule', recordId: row.id, action: 'create', after: input });
  return ok({ id: row.id });
}

export async function updateRule(ctx: Ctx, id: string, raw: RuleInput): Promise<Result<{ id: string }>> {
  const parsed = ruleInput.safeParse(raw);
  if (!parsed.success) return err('VALIDATION', 'Invalid rule');
  const input = parsed.data;
  const [before] = await ctx.tx.select().from(automationRules).where(eq(automationRules.id, id)).limit(1);
  if (!before) return err('NOT_FOUND', 'Rule not found');
  await ctx.tx
    .update(automationRules)
    .set({
      name: input.name,
      triggerEvent: input.triggerEvent,
      conditions: input.conditions as Condition[],
      action: input.action,
      actionConfig: input.actionConfig,
      active: input.active,
      updatedAt: new Date(),
    })
    .where(eq(automationRules.id, id));
  await audit(ctx, { entity: 'automation.rule', recordId: id, action: 'update', before, after: input });
  return ok({ id });
}
