import { z } from 'zod';
import { type ActionName } from './config';
import type { Condition, Op } from './conditions';
import type { RuleInput } from './service/rules';
import type { TRIGGER_EVENTS } from './engine';

// The settings form posts flat strings. These fields map onto one rule.
export const ruleFormInput = z.object({
  id: z.uuid().optional(),
  name: z.string().max(120),
  triggerEvent: z.string(),
  condField: z.string().max(100).optional().default(''),
  condOp: z.string().optional().default('eq'),
  condValue: z.string().max(200).optional().default(''),
  action: z.string(),
  entity: z.string().max(60).optional().default(''),
  recordIdField: z.string().max(100).optional().default(''),
  typeKey: z.string().max(60).optional().default(''),
  summary: z.string().max(200).optional().default(''),
  dueInDays: z.string().optional().default('0'),
  body: z.string().max(2000).optional().default(''),
  url: z.string().max(500).optional().default(''),
  active: z.string().optional(),
});
export type RuleFormInput = z.infer<typeof ruleFormInput>;

/** Maps the flat form onto the rule input. The service still validates everything strictly. */
export function toRuleInput(f: RuleFormInput): RuleInput {
  const conditions: Condition[] = f.condField
    ? [{ field: f.condField, op: f.condOp as Op, value: f.condValue }]
    : [];
  const actionConfig: Record<string, unknown> =
    f.action === 'create_activity'
      ? { entity: f.entity, recordIdField: f.recordIdField, typeKey: f.typeKey, summary: f.summary, dueInDays: Number(f.dueInDays) }
      : f.action === 'post_note'
        ? { entity: f.entity, recordIdField: f.recordIdField, body: f.body }
        : { url: f.url };
  return {
    name: f.name,
    triggerEvent: f.triggerEvent as (typeof TRIGGER_EVENTS)[number],
    conditions,
    action: f.action as ActionName,
    actionConfig,
    active: f.active === 'on' || f.active === 'true',
  };
}
