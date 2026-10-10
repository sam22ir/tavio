import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { err, ok, type Result } from '@/core/result';
import { actionConfigSchemas, ACTION_NAMES, type ActionName } from '../config';
import { conditionsSchema, type Condition } from '../conditions';
import { TRIGGER_EVENTS } from '../engine';
import { timeConfigSchema, type TimeConfig } from '../fields';
import { automationRules, type AutomationRule } from '../schema';

export const ruleInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    kind: z.enum(['event', 'time']).default('event'),
    triggerEvent: z.enum(TRIGGER_EVENTS).nullable().optional(),
    timeConfig: timeConfigSchema.nullable().optional(),
    conditions: conditionsSchema,
    action: z.enum(ACTION_NAMES as [ActionName, ...ActionName[]]),
    actionConfig: z.record(z.string(), z.unknown()),
    active: z.boolean(),
  })
  .superRefine((v, c) => {
    if (v.kind === 'event' && !v.triggerEvent) {
      c.addIssue({ code: 'custom', path: ['triggerEvent'], message: 'Choose an event' });
    }
    if (v.kind === 'time' && !v.timeConfig) {
      c.addIssue({ code: 'custom', path: ['timeConfig'], message: 'Choose a record type and date' });
    }
    const cfg = actionConfigSchemas[v.action].safeParse(v.actionConfig);
    if (!cfg.success) {
      c.addIssue({ code: 'custom', path: ['actionConfig'], message: 'Invalid action configuration' });
    }
  });
export type RuleInput = z.input<typeof ruleInput>;

export async function listRules(ctx: Ctx): Promise<AutomationRule[]> {
  return ctx.tx.select().from(automationRules).orderBy(asc(automationRules.name));
}

/** Column values for a rule input. Event rules keep no time config and time rules keep no trigger event. */
function ruleValues(input: z.output<typeof ruleInput>): {
  kind: 'event' | 'time';
  triggerEvent: string | null;
  timeConfig: TimeConfig | null;
} {
  return input.kind === 'time'
    ? { kind: 'time', triggerEvent: null, timeConfig: input.timeConfig ?? null }
    : { kind: 'event', triggerEvent: input.triggerEvent ?? null, timeConfig: null };
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
      ...ruleValues(input),
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
      ...ruleValues(input),
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
