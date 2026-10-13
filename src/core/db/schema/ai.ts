import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// AI call log for quotas and the settings usage table (WAVE-6 W6-C).
// `company_id` and `user_id` are not DB foreign keys here, matching the other schema files.
// RLS is hand-written SQL in a later migration.
export const aiUsage = pgTable(
  'ai_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    userId: uuid('user_id'),
    feature: text('feature').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('ai_usage_company_created_idx').on(t.companyId, t.createdAt)],
);

// Confirmable AI actions. The model proposes a kind plus IDs; the server computes the summary and
// re-validates everything on confirm. `payload` holds IDs and validated inputs only.
export const aiActions = pgTable(
  'ai_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    userId: uuid('user_id').notNull(),
    kind: text('kind').notNull(),
    payload: jsonb('payload').notNull(),
    summary: jsonb('summary').notNull(),
    state: text('state').notNull().default('proposed'),
    result: jsonb('result'),
    errorCode: text('error_code'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (t) => [
    index('ai_actions_company_state_created_idx').on(t.companyId, t.state, t.createdAt),
    check('ai_actions_state_check', sql`${t.state} in ('proposed', 'confirmed', 'rejected', 'failed')`),
  ],
);

// One row per reminder prepared by a confirmed reminder_batch. The next stage depends on these rows.
export const aiReminderLog = pgTable(
  'ai_reminder_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    contractId: uuid('contract_id').notNull(),
    partnerId: uuid('partner_id').notNull(),
    stage: text('stage').notNull(),
    actionId: uuid('action_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ai_reminder_log_company_contract_created_idx').on(t.companyId, t.contractId, t.createdAt),
    check('ai_reminder_log_stage_check', sql`${t.stage} in ('polite', 'firm', 'final')`),
  ],
);
