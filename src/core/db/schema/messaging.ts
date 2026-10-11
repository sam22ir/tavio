import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { companies } from './tenancy';

// Outbound messaging (W16-F). Tenant tables. Partner and user references are not DB foreign keys
// (module tables are not imported here), matching the portal tables.
// Table `outbound_messages` (not `messages`): the chatter module already owns `messages`.

const commonColumns = () => ({
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // references users.id (FK added by integrator)
  createdBy: uuid('created_by'),
});

// Outbox of outgoing messages. Written inside the business transaction by queueMessage,
// drained by the outbox cron (/api/cron/outbox). Rows are never deleted.
export const outboundMessages = pgTable(
  'outbound_messages',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // email | whatsapp. Email goes through Resend; whatsapp is manual (wa.me link in waUrl).
    channel: text('channel').notNull(),
    // email address, or E.164 phone for whatsapp
    toAddress: text('to_address').notNull(),
    partnerId: uuid('partner_id'),
    subject: text('subject').notNull().default(''),
    bodyHtml: text('body_html').notNull().default(''),
    bodyText: text('body_text').notNull().default(''),
    templateKey: text('template_key'),
    // Business record this message is about, for example 'invoicing.invoice'
    relatedEntity: text('related_entity'),
    relatedId: uuid('related_id'),
    // queued | sent | failed | manual
    state: text('state').notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
    availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
    lastError: text('last_error'),
    providerId: text('provider_id'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    // wa.me link for manual (whatsapp) messages
    waUrl: text('wa_url'),
    // True when the recipient had opted out and a transactional send went out anyway.
    overrideOptOut: boolean('override_opt_out').notNull().default(false),
    // Set for automatic reminders so the same reminder is never queued twice.
    dedupeKey: text('dedupe_key'),
  },
  (t) => [
    index('outbound_messages_company_state_idx').on(t.companyId, t.state),
    index('outbound_messages_company_related_idx').on(t.companyId, t.relatedEntity, t.relatedId),
    index('outbound_messages_queued_available_idx')
      .on(t.availableAt)
      .where(sql`${t.state} = 'queued'`),
    uniqueIndex('outbound_messages_company_dedupe_key_key')
      .on(t.companyId, t.dedupeKey)
      .where(sql`${t.dedupeKey} is not null`),
    check('outbound_messages_channel_check', sql`${t.channel} in ('email', 'whatsapp')`),
    check(
      'outbound_messages_state_check',
      sql`${t.state} in ('queued', 'sent', 'failed', 'manual')`,
    ),
  ],
);

// Per-company template overrides. A missing row means the built-in default (fr or ar) applies.
export const messageTemplates = pgTable(
  'message_templates',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    key: text('key').notNull(),
    locale: text('locale').notNull(),
    subject: text('subject').notNull(),
    // Plain text with {variables}. Converted to HTML when rendered.
    body: text('body').notNull(),
  },
  (t) => [
    uniqueIndex('message_templates_company_key_locale_key').on(t.companyId, t.key, t.locale),
    check('message_templates_locale_check', sql`${t.locale} in ('fr', 'ar')`),
  ],
);

// Partners who opted out of a channel. Reminders and campaigns skip them.
export const messageOptOuts = pgTable(
  'message_opt_outs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    partnerId: uuid('partner_id').notNull(),
    channel: text('channel').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('message_opt_outs_company_partner_channel_key').on(t.companyId, t.partnerId, t.channel),
    check('message_opt_outs_channel_check', sql`${t.channel} in ('email', 'whatsapp')`),
  ],
);

// One row per company: automatic reminder settings (default off).
export const messageSettings = pgTable(
  'message_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    remindersEnabled: boolean('reminders_enabled').notNull().default(false),
    // days before the due date for the "before" reminder
    beforeDays: smallint('before_days').notNull().default(3),
    // days after the due date for each overdue reminder
    overdueDays: jsonb('overdue_days').notNull().default(sql`'[1, 7]'::jsonb`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('message_settings_company_id_key').on(t.companyId),
    check('message_settings_before_days_check', sql`${t.beforeDays} between 0 and 30`),
  ],
);

export type OutboundMessage = typeof outboundMessages.$inferSelect;
export type MessageTemplateRow = typeof messageTemplates.$inferSelect;
