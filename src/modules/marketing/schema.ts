import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { companies } from '@/core/db/schema/tenancy';
import { partners } from '@/modules/contacts/schema';

// Common columns (DATA_MODEL.md 0.1). `created_by` references users.id (FK added by integrator).
const commonColumns = () => ({
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // FK → users.id (added by integrator)
  createdBy: uuid('created_by'),
});

// Marketing campaigns. Tenant table. Recipients are built from a segment; sending is manual (no bulk API).
export const campaigns = pgTable(
  'campaigns',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    name: text('name').notNull(),
    // whatsapp (sent by the user through wa.me links), sms, email
    channel: text('channel').notNull(),
    // Language of the message the recipients receive: fr or ar
    language: text('language').notNull().default('fr'),
    messageFr: text('message_fr').notNull(),
    messageAr: text('message_ar').notNull(),
    // { customer, prospect, wilaya, hasOverdue }. Empty object = every active partner with a phone.
    segment: jsonb('segment').notNull().default({}),
    state: text('state').notNull().default('draft'),
  },
  (t) => [
    index('marketing_campaigns_company_id_state_idx').on(t.companyId, t.state),
    check('marketing_campaigns_channel_check', sql`${t.channel} in ('whatsapp', 'sms', 'email')`),
    check('marketing_campaigns_language_check', sql`${t.language} in ('fr', 'ar')`),
    check('marketing_campaigns_state_check', sql`${t.state} in ('draft', 'ready', 'sent')`),
  ],
);

// One row per partner in a campaign. Tenant table.
export const campaignRecipients = pgTable(
  'campaign_recipients',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    partnerId: uuid('partner_id')
      .notNull()
      .references(() => partners.id),
    // E.164, copied from the partner when the recipients were built
    phone: text('phone').notNull(),
    status: text('status').notNull().default('pending'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (t) => [
    index('marketing_campaign_recipients_company_id_campaign_id_idx').on(t.companyId, t.campaignId),
    uniqueIndex('marketing_campaign_recipients_company_id_campaign_id_partner_id_key').on(
      t.companyId,
      t.campaignId,
      t.partnerId,
    ),
    check(
      'marketing_campaign_recipients_status_check',
      sql`${t.status} in ('pending', 'sent', 'failed')`,
    ),
  ],
);

export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
export type NewCampaignRecipient = typeof campaignRecipients.$inferInsert;
