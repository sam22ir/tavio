import { sql } from 'drizzle-orm';
import { boolean, check, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { companies } from '@/core/db/schema/tenancy';

// Automation rules (W5-L). Tenant table. Trigger names come from src/core/events/catalog.ts.
export const automationRules = pgTable(
  'automation_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    // FK → users.id (added by integrator)
    createdBy: uuid('created_by'),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    name: text('name').notNull(),
    // Event name from the catalog, e.g. 'sales.order.confirmed'
    triggerEvent: text('trigger_event').notNull(),
    // [{ field, op: eq|neq|gt|gte|lt|lte, value }] evaluated against the event payload
    conditions: jsonb('conditions').notNull().default([]),
    action: text('action').notNull(),
    actionConfig: jsonb('action_config').notNull().default({}),
    active: boolean('active').notNull().default(true),
  },
  (t) => [
    check('automation_rules_action_check', sql`${t.action} in ('create_activity','post_note','webhook')`),
    index('automation_rules_company_id_trigger_idx').on(t.companyId, t.triggerEvent, t.active),
  ],
);

export type AutomationRule = typeof automationRules.$inferSelect;
export type NewAutomationRule = typeof automationRules.$inferInsert;
