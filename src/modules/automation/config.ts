import { z } from 'zod';
import { EVENT_NAMES, type EventName } from '@/core/events/catalog';
import { checkUpdateValue, UPDATE_ENTITIES, type UpdateEntity } from './fields';

// Per-action configuration. Validated when a rule is saved and again before it runs.
const entityRef = z.string().regex(/^[a-z_]+\.[a-z_]+$/, 'Use module.entity, e.g. sales.order');
const payloadPath = z.string().min(1).max(100).regex(/^[A-Za-z0-9_.]+$/, 'Invalid field path');
const uuid = z.uuid();

const baseSchemas = {
  // Creates a chatter activity on the record named by recordIdField (idempotent per type and record).
  create_activity: z.object({
    entity: entityRef,
    recordIdField: payloadPath,
    typeKey: z.string().min(1).max(60),
    summary: z.string().min(1).max(200),
    dueInDays: z.number().int().min(0).max(365),
  }),
  // Posts a chatter note. {field} placeholders in body are replaced with payload values.
  post_note: z.object({
    entity: entityRef,
    recordIdField: payloadPath,
    body: z.string().min(1).max(2000),
  }),
  // Queues an outbox row (eventType automation.webhook) for the outbox drain to POST.
  webhook: z.object({
    url: z.string().max(500).refine((u) => u.startsWith('https://'), 'Webhook URL must use https'),
  }),
  // Sets whitelisted columns on the record. Values are checked against UPDATABLE_FIELDS.
  update_record: z
    .object({
      entity: z.enum(UPDATE_ENTITIES),
      recordIdField: payloadPath,
      updates: z.record(z.string().min(1).max(60), z.string().max(500)).refine((u) => Object.keys(u).length > 0, 'Add at least one field'),
    })
    .superRefine((cfg, c) => {
      for (const [field, value] of Object.entries(cfg.updates)) {
        const problem = checkUpdateValue(cfg.entity as UpdateEntity, field, value);
        if (problem) c.addIssue({ code: 'custom', path: ['updates', field], message: problem });
      }
    }),
  // Launches an active activity plan on the record. Earlier runs are cancelled first unless cancelPrevious is false.
  launch_activity_plan: z.object({
    entity: entityRef,
    recordIdField: payloadPath,
    planId: uuid,
    ownerField: payloadPath.optional(),
    cancelPrevious: z.boolean().default(true),
  }),
  // Cancels the open activities of every plan run on the record.
  cancel_activity_plans: z.object({
    entity: entityRef,
    recordIdField: payloadPath,
  }),
};

const SUB_ACTIONS = ['create_activity', 'post_note', 'webhook', 'update_record', 'launch_activity_plan', 'cancel_activity_plans'] as const;

// Runs an ordered list of the other actions. Nested multi is not allowed.
const multiSchema = z
  .object({
    actions: z
      .array(z.object({ action: z.enum(SUB_ACTIONS), config: z.record(z.string(), z.unknown()) }))
      .min(1)
      .max(10),
  })
  .superRefine((cfg, c) => {
    cfg.actions.forEach((step, i) => {
      const parsed = (baseSchemas[step.action] as z.ZodType).safeParse(step.config);
      if (!parsed.success) c.addIssue({ code: 'custom', path: ['actions', i, 'config'], message: 'Invalid step configuration' });
    });
  });

export const actionConfigSchemas = {
  ...baseSchemas,
  multi: multiSchema,
} as const;

export type ActionName = keyof typeof actionConfigSchemas;
export const ACTION_NAMES = Object.keys(actionConfigSchemas) as ActionName[];

// Client-safe: rule forms import this, so it must not pull in the engine (server-only).
export const TRIGGER_EVENTS = EVENT_NAMES satisfies readonly EventName[];
