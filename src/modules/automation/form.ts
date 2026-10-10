import { z } from 'zod';
import { type ActionName } from './config';
import type { Condition, Op } from './conditions';
import type { RuleInput } from './service/rules';
import type { TRIGGER_EVENTS } from './engine';

// The settings form posts flat strings. These fields map onto one rule.
export const ruleFormInput = z.object({
  id: z.uuid().optional(),
  name: z.string().max(120),
  kind: z.string().optional().default('event'),
  triggerEvent: z.string().optional().default(''),
  timeEntity: z.string().optional().default(''),
  dateField: z.string().max(60).optional().default(''),
  delayDays: z.string().optional().default('0'),
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
  planId: z.string().max(60).optional().default(''),
  ownerField: z.string().max(100).optional().default(''),
  cancelPrevious: z.string().optional(),
  updates: z.string().max(4000).optional().default(''),
  steps: z.string().max(20000).optional().default(''),
  active: z.string().optional(),
});
export type RuleFormInput = z.infer<typeof ruleFormInput>;

/** Parses "field=value" lines. Blank lines are skipped; a line without "=" is kept with an empty value so validation rejects it. */
export function parseUpdateLines(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    const field = (eq === -1 ? trimmed : trimmed.slice(0, eq)).trim();
    out[field] = eq === -1 ? '' : trimmed.slice(eq + 1).trim();
  }
  return out;
}

/** Parses the JSON steps of a multi action. Anything unreadable becomes an empty list, which the service refuses. */
export function parseSteps(text: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(text || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function actionConfigFor(f: RuleFormInput): Record<string, unknown> {
  switch (f.action) {
    case 'create_activity':
      return { entity: f.entity, recordIdField: f.recordIdField, typeKey: f.typeKey, summary: f.summary, dueInDays: Number(f.dueInDays) };
    case 'post_note':
      return { entity: f.entity, recordIdField: f.recordIdField, body: f.body };
    case 'update_record':
      return { entity: f.entity, recordIdField: f.recordIdField, updates: parseUpdateLines(f.updates) };
    case 'launch_activity_plan':
      return {
        entity: f.entity,
        recordIdField: f.recordIdField,
        planId: f.planId,
        ownerField: f.ownerField || undefined,
        cancelPrevious: f.cancelPrevious === 'on' || f.cancelPrevious === 'true',
      };
    case 'cancel_activity_plans':
      return { entity: f.entity, recordIdField: f.recordIdField };
    case 'multi':
      return { actions: parseSteps(f.steps) };
    default:
      return { url: f.url };
  }
}

/** Maps the flat form onto the rule input. The service still validates everything strictly. */
export function toRuleInput(raw: z.input<typeof ruleFormInput>): RuleInput {
  const f = ruleFormInput.parse(raw);
  const conditions: Condition[] = f.condField
    ? [{ field: f.condField, op: f.condOp as Op, value: f.condValue }]
    : [];
  const isTime = f.kind === 'time';
  return {
    name: f.name,
    kind: isTime ? 'time' : 'event',
    triggerEvent: isTime ? null : (f.triggerEvent as (typeof TRIGGER_EVENTS)[number]),
    timeConfig: isTime
      ? { entity: f.timeEntity as 'lead' | 'activity' | 'credit_contract', dateField: f.dateField, delayDays: Number(f.delayDays) }
      : null,
    conditions,
    action: f.action as ActionName,
    actionConfig: actionConfigFor(f),
    active: f.active === 'on' || f.active === 'true',
  };
}
