'use server';

import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
import type { Ctx } from '@/core/ctx';
import { err, type Result } from '@/core/result';
import { TEMPLATE_KEYS } from './template';
import {
  DOC_PERM,
  prepareDocumentMessage,
  resetTemplate,
  saveMessageSettings,
  saveTemplate,
  sendDocumentMessage,
  type DocumentEntity,
} from './service';

const DOC_ENTITIES = ['sales.order', 'invoicing.invoice', 'credit_sales.contract', 'credit_sales.receipt', 'contacts.partner'] as const satisfies readonly DocumentEntity[];
const CHANNELS = ['email', 'whatsapp'] as const;

const refShape = z.object({
  entity: z.enum(DOC_ENTITIES),
  recordId: z.uuid(),
  partnerId: z.uuid(),
  templateKey: z.enum(TEMPLATE_KEYS),
  channel: z.enum(CHANNELS),
});
const sendShape = refShape.extend({
  to: z.string().max(320),
  subject: z.string().max(300),
  body: z.string().max(5000),
});

/**
 * defineAction takes one fixed perm, so each entity gets its own wrapper. The entity is validated
 * first, then the wrapper for that entity's read permission runs. Never throws.
 */
function byEntity<S extends z.ZodType<{ entity: DocumentEntity }>, T>(
  schema: S,
  fn: (ctx: Ctx, input: z.infer<S>) => Promise<Result<T>>,
) {
  return async (raw: unknown): Promise<Result<T>> => {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return err('VALIDATION', 'Invalid input');
    const perm = DOC_PERM[parsed.data.entity];
    const run = defineAction({ perm, schema }, fn);
    return run(parsed.data as z.input<S>);
  };
}

const prepareAction = byEntity(refShape, (ctx, input) =>
  prepareDocumentMessage(ctx, { entity: input.entity, recordId: input.recordId, partnerId: input.partnerId }, input.templateKey, input.channel),
);

const sendAction = byEntity(sendShape, (ctx, input) => sendDocumentMessage(ctx, input));

/** Renders the default message for the send dialog. */
export async function prepareDocumentMessageAction(raw: unknown) {
  return prepareAction(raw);
}

/** Queues one document or portal invite message and adds a chatter note. */
export async function sendDocumentMessageAction(raw: unknown) {
  return sendAction(raw);
}

const templateShape = z.object({
  key: z.enum(TEMPLATE_KEYS),
  locale: z.enum(['fr', 'ar']),
  subject: z.string().max(300),
  body: z.string().max(5000),
});

const saveTemplateAction = defineAction(
  { perm: 'messaging.template.write', schema: templateShape },
  (ctx, input) => saveTemplate(ctx, input.key, input.locale, { subject: input.subject, body: input.body }),
);

const resetShape = z.object({ key: z.enum(TEMPLATE_KEYS), locale: z.enum(['fr', 'ar']) });

const resetTemplateAction = defineAction(
  { perm: 'messaging.template.write', schema: resetShape },
  (ctx, input) => resetTemplate(ctx, input.key, input.locale),
);

const settingsShape = z.object({
  remindersEnabled: z.boolean(),
  beforeDays: z.number().int().min(0).max(30),
  overdueDays: z.array(z.number().int().min(0).max(60)).max(5),
});

const saveSettingsAction = defineAction(
  { perm: 'messaging.template.write', schema: settingsShape },
  (ctx, input) => saveMessageSettings(ctx, input),
);

export async function saveTemplateFormAction(raw: z.input<typeof templateShape>) {
  return saveTemplateAction(raw);
}

export async function resetTemplateFormAction(raw: z.input<typeof resetShape>) {
  return resetTemplateAction(raw);
}

export async function saveMessageSettingsAction(raw: z.input<typeof settingsShape>) {
  return saveSettingsAction(raw);
}

