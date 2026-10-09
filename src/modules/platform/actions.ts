'use server';

import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
import { CUSTOM_ENTITIES, CUSTOM_FIELD_TYPES, API_SCOPES } from './constants';
import { createCustomFieldDef, deleteCustomFieldDef, setCustomValues } from './service/custom-fields';
import { createApiKey, revokeApiKey } from './service/api-keys';
import { createWebhook, setWebhookActive } from './service/webhooks';

const MODULE = 'platform';
const CF_WRITE = 'platform.custom_field.write';
const KEY_WRITE = 'platform.api_key.write';
const HOOK_WRITE = 'platform.webhook.write';

const entity = z.enum(CUSTOM_ENTITIES);
const idSchema = z.object({ id: z.uuid() });

const customFieldInput = z.object({
  entity,
  key: z.string().trim().min(1).max(40),
  labelFr: z.string().trim().min(1).max(100),
  labelAr: z.string().trim().min(1).max(100),
  labelEn: z.string().trim().min(1).max(100),
  fieldType: z.enum(CUSTOM_FIELD_TYPES),
  options: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
  required: z.boolean().default(false),
  position: z.number().int().min(0).max(10_000).default(0),
});

export const createCustomFieldAction = defineAction(
  { perm: CF_WRITE, schema: customFieldInput, module: MODULE },
  (ctx, input) => createCustomFieldDef(ctx, input),
);

export const deleteCustomFieldAction = defineAction(
  { perm: CF_WRITE, schema: idSchema, module: MODULE },
  (ctx, input) => deleteCustomFieldDef(ctx, input.id),
);

export const saveCustomValuesAction = defineAction(
  { perm: 'contacts.partner.write', schema: z.object({ entity, recordId: z.uuid(), values: z.record(z.string(), z.unknown()) }), module: MODULE },
  (ctx, input) => setCustomValues(ctx, input),
);

export const createApiKeyAction = defineAction(
  {
    perm: KEY_WRITE,
    schema: z.object({ name: z.string().trim().min(1).max(100), scopes: z.array(z.enum(API_SCOPES)).min(1) }),
    module: MODULE,
  },
  (ctx, input) => createApiKey(ctx, input),
);

export const revokeApiKeyAction = defineAction(
  { perm: KEY_WRITE, schema: idSchema, module: MODULE },
  (ctx, input) => revokeApiKey(ctx, input.id),
);

export const createWebhookAction = defineAction(
  {
    perm: HOOK_WRITE,
    schema: z.object({ url: z.string().trim().min(1).max(500), events: z.array(z.string()).min(1).max(20) }),
    module: MODULE,
  },
  (ctx, input) => createWebhook(ctx, input),
);

export const setWebhookActiveAction = defineAction(
  { perm: HOOK_WRITE, schema: z.object({ id: z.uuid(), active: z.boolean() }), module: MODULE },
  (ctx, input) => setWebhookActive(ctx, input.id, input.active),
);
