import { index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Rows created by the sample-data seeder for one company, so they can be removed again.
// Tenant table: RLS on company_id (policy added in the migration).
export const sampleRecords = pgTable(
  'sample_records',
  {
    companyId: uuid('company_id').notNull(),
    tableName: text('table_name').notNull(),
    recordId: uuid('record_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.tableName, t.recordId] }),
    index('sample_records_company_id_idx').on(t.companyId),
  ],
);
