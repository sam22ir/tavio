import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { companies } from '@/core/db/schema/tenancy';

// Common columns (DATA_MODEL.md 0.1). `created_by` references users.id (FK added by integrator).
const commonColumns = () => ({
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
});

// Custom field definitions (DATA_MODEL.md 3.12, shape from the W5-K task). Values live in `<table>.custom` jsonb.
export const customFieldDefs = pgTable(
  'custom_field_defs',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // e.g. 'contacts.partner'
    entity: text('entity').notNull(),
    // snake_case, stable. Used as the JSON key in `custom`
    key: text('key').notNull(),
    labelFr: text('label_fr').notNull(),
    labelAr: text('label_ar').notNull(),
    labelEn: text('label_en').notNull(),
    fieldType: text('type').notNull(),
    // choices for type = select
    options: jsonb('options'),
    required: boolean('required').notNull().default(false),
    position: integer('position').notNull().default(0),
  },
  (t) => [
    index('custom_field_defs_company_id_entity_position_idx').on(t.companyId, t.entity, t.position),
    uniqueIndex('custom_field_defs_company_id_entity_key_key').on(t.companyId, t.entity, t.key),
    check('custom_field_defs_type_check', sql`${t.fieldType} in ('text', 'number', 'date', 'boolean', 'select')`),
    check('custom_field_defs_key_check', sql`${t.key} ~ '^[a-z][a-z0-9_]{0,39}$'`),
  ],
);

// API keys (W5-K). Only the sha-256 hash is stored; the token is shown once at creation.
export const apiKeys = pgTable(
  'api_keys',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    name: text('name').notNull(),
    // first characters of the token, shown in lists
    prefix: text('prefix').notNull(),
    // hex sha-256 of the full token
    hash: text('hash').notNull(),
    scopes: text('scopes').array().notNull().default(sql`'{}'::text[]`),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    index('api_keys_company_id_revoked_at_idx').on(t.companyId, t.revokedAt),
    uniqueIndex('api_keys_hash_key').on(t.hash),
    index('api_keys_company_id_prefix_idx').on(t.companyId, t.prefix),
  ],
);

// Webhook endpoints (W5-K). Signed with `secret` (HMAC-SHA256).
export const webhooks = pgTable(
  'webhooks',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    url: text('url').notNull(),
    events: text('events').array().notNull().default(sql`'{}'::text[]`),
    secret: text('secret').notNull(),
    active: boolean('active').notNull().default(true),
  },
  (t) => [index('webhooks_company_id_active_idx').on(t.companyId, t.active)],
);

// One row per webhook and outbox event. `status` pending, sent or failed.
export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    webhookId: uuid('webhook_id')
      .notNull()
      .references(() => webhooks.id, { onDelete: 'cascade' }),
    // outbox.id of the event being delivered (idempotency key)
    outboxId: uuid('outbox_id').notNull(),
    eventName: text('event_name').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
  },
  (t) => [
    index('webhook_deliveries_company_id_webhook_id_idx').on(t.companyId, t.webhookId),
    uniqueIndex('webhook_deliveries_webhook_id_outbox_id_key').on(t.webhookId, t.outboxId),
    check('webhook_deliveries_status_check', sql`${t.status} in ('pending', 'sent', 'failed')`),
  ],
);

export type CustomFieldDef = typeof customFieldDefs.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Webhook = typeof webhooks.$inferSelect;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
