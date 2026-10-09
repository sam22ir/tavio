import { z } from 'zod';

// Per-action configuration. Validated when a rule is saved and again before it runs.
const entityRef = z.string().regex(/^[a-z_]+\.[a-z_]+$/, 'Use module.entity, e.g. sales.order');
const payloadPath = z.string().min(1).max(100).regex(/^[A-Za-z0-9_.]+$/, 'Invalid field path');

export const actionConfigSchemas = {
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
} as const;

export type ActionName = keyof typeof actionConfigSchemas;
export const ACTION_NAMES = Object.keys(actionConfigSchemas) as ActionName[];
