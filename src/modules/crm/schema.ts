import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { companies } from '@/core/db/schema/tenancy';

// Common columns (DATA_MODEL.md 0.1). Tenant tables add company_id (0.2).
const commonColumns = () => ({
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // references users.id (FK added by integrator)
  createdBy: uuid('created_by'),
});

// Pipelines (DATA_MODEL.md 5.1). Tenant table.
export const pipelines = pgTable(
  'pipelines',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    name: text('name').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    active: boolean('active').notNull().default(true),
    // optional team restriction (guess in DATA_MODEL.md)
    // references users.id[] (FK added by integrator)
    teamUserIds: uuid('team_user_ids').array(),
  },
  (t) => [
    index('pipelines_company_id_active_idx').on(t.companyId, t.active),
    uniqueIndex('pipelines_company_id_name_key').on(t.companyId, t.name),
    uniqueIndex('pipelines_company_id_default_key')
      .on(t.companyId)
      .where(sql`${t.isDefault}`),
  ],
);

// Stages (DATA_MODEL.md 5.2). Tenant table. Ordered columns of a pipeline.
export const stages = pgTable(
  'stages',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    pipelineId: uuid('pipeline_id')
      .notNull()
      .references(() => pipelines.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // order within the pipeline
    position: integer('position').notNull(),
    // 0 to 100. Default for new leads in this stage
    probability: integer('probability').notNull(),
    // a won stage closes the lead as won
    isWon: boolean('is_won').notNull().default(false),
    // collapsed in kanban
    fold: boolean('fold').notNull().default(false),
  },
  (t) => [
    index('stages_company_id_pipeline_id_position_idx').on(t.companyId, t.pipelineId, t.position),
    uniqueIndex('stages_pipeline_id_position_key').on(t.pipelineId, t.position),
    uniqueIndex('stages_pipeline_id_name_key').on(t.pipelineId, t.name),
    // at most one won stage per pipeline (guess in DATA_MODEL.md)
    uniqueIndex('stages_pipeline_id_is_won_key')
      .on(t.pipelineId)
      .where(sql`${t.isWon}`),
    check('stages_probability_check', sql`${t.probability} between 0 and 100`),
  ],
);

// Lost reasons (DATA_MODEL.md 5.3). Tenant table.
export const lostReasons = pgTable(
  'lost_reasons',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    name: text('name').notNull(),
    active: boolean('active').notNull().default(true),
  },
  (t) => [
    index('lost_reasons_company_id_active_idx').on(t.companyId, t.active),
    uniqueIndex('lost_reasons_company_id_name_key').on(t.companyId, t.name),
  ],
);

// Leads and opportunities (DATA_MODEL.md 5.4). Tenant table.
// One table for leads and opportunities (type field), as in Odoo's crm.lead.
export const leads = pgTable(
  'leads',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // from sequences code `lead`. Optional, set on save
    reference: text('reference'),
    // `lead` or `opportunity`. Set to `opportunity` when moved past the first stage (guess)
    type: text('type').notNull().default('lead'),
    // short title, for example "Achat frigo, Oran"
    name: text('name').notNull(),
    // FK → partners.id (added by integrator). Null until identified
    partnerId: uuid('partner_id'),
    // used when partner_id is null
    contactName: text('contact_name'),
    // E.164
    phone: text('phone'),
    email: text('email'),
    wilayaCode: text('wilaya_code'),
    // walk_in, phone, facebook, instagram, whatsapp, referral, other
    source: text('source'),
    pipelineId: uuid('pipeline_id')
      .notNull()
      .references(() => pipelines.id),
    // same pipeline as pipeline_id, checked in service
    stageId: uuid('stage_id')
      .notNull()
      .references(() => stages.id),
    status: text('status').notNull().default('open'),
    // starts from stage, can be edited
    probability: integer('probability').notNull(),
    expectedRevenueCents: bigint('expected_revenue_cents', { mode: 'bigint' }),
    expectedCloseDate: date('expected_close_date'),
    // FK → users.id (added by integrator)
    salespersonId: uuid('salesperson_id'),
    // 0 normal, 1 high
    priority: smallint('priority').notNull().default(0),
    lostReasonId: uuid('lost_reason_id').references(() => lostReasons.id),
    lostAt: timestamp('lost_at', { withTimezone: true }),
    wonAt: timestamp('won_at', { withTimezone: true }),
    // FK → contracts.id (added by integrator). Set on conversion
    convertedContractId: uuid('converted_contract_id'),
    // FK → quotes.id is added by the P4 migration, together with its
    // "at most one converted_* set" check.
    // converted_quote_id uuid
    // Archived leads are active = false
    active: boolean('active').notNull().default(true),
    // denormalized pointer for kanban, optional (guess in DATA_MODEL.md)
    // FK → activities.id (added by integrator)
    nextActivityId: uuid('next_activity_id'),
  },
  (t) => [
    index('leads_company_id_pipeline_id_stage_id_idx').on(t.companyId, t.pipelineId, t.stageId),
    index('leads_company_id_status_idx').on(t.companyId, t.status),
    index('leads_company_id_salesperson_id_status_idx').on(
      t.companyId,
      t.salespersonId,
      t.status,
    ),
    index('leads_company_id_partner_id_idx').on(t.companyId, t.partnerId),
    index('leads_company_id_phone_idx').on(t.companyId, t.phone),
    uniqueIndex('leads_company_id_reference_key')
      .on(t.companyId, t.reference)
      .where(sql`${t.reference} is not null`),
    check('leads_type_check', sql`${t.type} in ('lead', 'opportunity')`),
    check('leads_status_check', sql`${t.status} in ('open', 'won', 'lost')`),
    check(
      'leads_source_check',
      sql`${t.source} is null or ${t.source} in ('walk_in', 'phone', 'facebook', 'instagram', 'whatsapp', 'referral', 'other')`,
    ),
    check('leads_probability_check', sql`${t.probability} between 0 and 100`),
    check(
      'leads_expected_revenue_check',
      sql`${t.expectedRevenueCents} is null or ${t.expectedRevenueCents} >= 0`,
    ),
    check('leads_priority_check', sql`${t.priority} in (0, 1)`),
    check(
      'leads_lost_check',
      sql`${t.status} <> 'lost' or (${t.lostReasonId} is not null and ${t.lostAt} is not null)`,
    ),
    check('leads_won_check', sql`${t.status} <> 'won' or ${t.wonAt} is not null`),
  ],
);

// Tags (DATA_MODEL.md 5.5). Tenant table. Free labels, reusable across records.
export const tags = pgTable(
  'tags',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    name: text('name').notNull(),
    // hex, #RRGGBB
    color: text('color'),
  },
  (t) => [
    index('tags_company_id_idx').on(t.companyId),
    uniqueIndex('tags_company_id_name_key').on(t.companyId, t.name),
    check(
      'tags_color_check',
      sql`${t.color} is null or ${t.color} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
  ],
);

// Tag links (DATA_MODEL.md 5.6). Tenant table. Join table for tags on any record.
export const tagLinks = pgTable(
  'tag_links',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    // for example crm.lead
    entity: text('entity').notNull(),
    // polymorphic, no database FK (checked in service)
    recordId: uuid('record_id').notNull(),
  },
  (t) => [
    index('tag_links_company_id_entity_record_id_idx').on(t.companyId, t.entity, t.recordId),
    index('tag_links_company_id_tag_id_idx').on(t.companyId, t.tagId),
    uniqueIndex('tag_links_tag_id_entity_record_id_key').on(t.tagId, t.entity, t.recordId),
  ],
);

export type Pipeline = typeof pipelines.$inferSelect;
export type NewPipeline = typeof pipelines.$inferInsert;
export type Stage = typeof stages.$inferSelect;
export type NewStage = typeof stages.$inferInsert;
export type LostReason = typeof lostReasons.$inferSelect;
export type NewLostReason = typeof lostReasons.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type TagLink = typeof tagLinks.$inferSelect;
export type NewTagLink = typeof tagLinks.$inferInsert;

// Default pipeline seed (DATA_MODEL.md 5.2). Lost is a leads.status, not a stage. Used by the tenant bootstrap, not a table.
export const DEFAULT_PIPELINE = {
  name: 'Sales',
  isDefault: true,
  stages: [
    { key: 'new', position: 0, probability: 10, isWon: false, names: { fr: 'Nouveau', ar: 'جديد', en: 'New' } },
    { key: 'qualified', position: 1, probability: 30, isWon: false, names: { fr: 'Qualifié', ar: 'مؤهل', en: 'Qualified' } },
    { key: 'proposal', position: 2, probability: 60, isWon: false, names: { fr: 'Proposition', ar: 'عرض', en: 'Proposal' } },
    { key: 'won', position: 3, probability: 100, isWon: true, names: { fr: 'Gagné', ar: 'مربوح', en: 'Won' } },
  ],
} as const;
