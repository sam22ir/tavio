import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
