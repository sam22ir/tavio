import { sql } from 'drizzle-orm';
import { boolean, check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { companies } from '@/core/db/schema/tenancy';

// Automation rules (W5-L). Tenant table. Event rules name a catalog event; time rules compare a date field.
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
    // 'event' (default, existing rules) or 'time' (W13-AUTO)
    kind: text('kind').notNull().default('event'),
    // Event name from the catalog, e.g. 'sales.order.confirmed'. Null for time rules.
    triggerEvent: text('trigger_event'),
    // Time rules: { entity: lead | activity | credit_contract, dateField, delayDays }. Null for event rules.
    timeConfig: jsonb('time_config'),
    // [{ field, op: eq|neq|gt|gte|lt|lte, value }] evaluated against the event payload or the record row
    conditions: jsonb('conditions').notNull().default([]),
    action: text('action').notNull(),
    actionConfig: jsonb('action_config').notNull().default({}),
    active: boolean('active').notNull().default(true),
  },
  (t) => [
    check('automation_rules_action_check', sql`${t.action} in ('create_activity','post_note','webhook','update_record','launch_activity_plan','cancel_activity_plans','multi')`),
    check('automation_rules_kind_check', sql`${t.kind} in ('event','time')`),
    index('automation_rules_company_id_trigger_idx').on(t.companyId, t.triggerEvent, t.active),
  ],
);

// One row per (rule, record) once a time rule has fired, so each record fires a rule only once (W13-AUTO).
export const automationRuleRuns = pgTable(
  'automation_rule_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    ruleId: uuid('rule_id')
      .notNull()
      .references(() => automationRules.id, { onDelete: 'cascade' }),
    recordId: uuid('record_id').notNull(),
    // done: the action took effect. skipped: the record was due but its conditions did not match.
    status: text('status').notNull().default('done'),
    firedAt: timestamp('fired_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('automation_rule_runs_company_rule_record_uq').on(t.companyId, t.ruleId, t.recordId),
    check('automation_rule_runs_status_check', sql`${t.status} in ('done','skipped')`),
  ],
);

export type AutomationRule = typeof automationRules.$inferSelect;
export type NewAutomationRule = typeof automationRules.$inferInsert;
