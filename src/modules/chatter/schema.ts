import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { companies } from '@/core/db/schema/tenancy';

// Common columns (DATA_MODEL.md 0.1). `created_by` references users.id (FK added by integrator).
const commonColumns = () => ({
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // references users.id (FK added by integrator)
  createdBy: uuid('created_by'),
});

// 3.8 messages. Chatter entries on any record. Tenant table.
export const messages = pgTable(
  'messages',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // module entity name, for example credit_sales.contract (no DB foreign key)
    entity: text('entity').notNull(),
    recordId: uuid('record_id').notNull(),
    // comment, note, system
    type: text('type').notNull(),
    // markdown-lite, sanitized. Null for pure tracking rows
    body: text('body'),
    // {field: [before, after]} for system rows
    tracking: jsonb('tracking'),
    // notes are internal
    isInternal: boolean('is_internal').notNull().default(false),
    editedAt: timestamp('edited_at', { withTimezone: true }),
  },
  (t) => [
    index('messages_company_entity_record_idx').on(
      t.companyId,
      t.entity,
      t.recordId,
      t.createdAt.desc(),
    ),
    check('messages_type_check', sql`${t.type} in ('comment', 'note', 'system')`),
  ],
);

// 3.9 activity_types. Tenant table.
export const activityTypes = pgTable(
  'activity_types',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // Call, WhatsApp, Visit, Reminder, Other
    name: text('name').notNull(),
    // null = usable on all entities
    entity: text('entity'),
    // due date offset from creation
    defaultDays: integer('default_days').notNull().default(0),
    // icon key
    icon: text('icon'),
    active: boolean('active').notNull().default(true),
    // Delay from the trigger date. Replaces default_days (backfilled in the RLS file).
    delayCount: integer('delay_count').notNull().default(0),
    delayUnit: text('delay_unit').notNull().default('days'),
    // default, phonecall, upload_file, meeting
    category: text('category').notNull().default('default'),
    // suggest: the UI pre-fills the next activity. trigger: the next activity is created on completion.
    chainingType: text('chaining_type').notNull().default('suggest'),
    nextTypeId: uuid('next_type_id').references((): AnyPgColumn => activityTypes.id),
    // FK users.id (added by integrator). Default assignee for new activities of this type.
    defaultUserId: uuid('default_user_id'),
    // When set, completing an activity of this type needs a result.
    requireResult: boolean('require_result').notNull().default(false),
  },
  (t) => [
    index('activity_types_company_entity_idx').on(t.companyId, t.entity),
    unique('activity_types_company_name_entity_key')
      .on(t.companyId, t.name, t.entity)
      .nullsNotDistinct(),
    check('activity_types_delay_unit_check', sql`${t.delayUnit} in ('days', 'weeks')`),
    check(
      'activity_types_category_check',
      sql`${t.category} in ('default', 'phonecall', 'upload_file', 'meeting')`,
    ),
    check('activity_types_chaining_check', sql`${t.chainingType} in ('suggest', 'trigger')`),
  ],
);

// 3.10 activities. Scheduled tasks on a record. Tenant table.
// Derived state (not stored): done if done_at is set; overdue if due_date < today;
// today if due_date = today; otherwise planned.
export const activities = pgTable(
  'activities',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    entity: text('entity').notNull(),
    recordId: uuid('record_id').notNull(),
    activityTypeId: uuid('activity_type_id')
      .notNull()
      .references(() => activityTypes.id),
    // FK users.id (added by integrator)
    assigneeId: uuid('assignee_id').notNull(),
    summary: text('summary').notNull(),
    note: text('note'),
    dueDate: date('due_date', { mode: 'string' }).notNull(),
    doneAt: timestamp('done_at', { withTimezone: true }),
    // FK users.id (added by integrator)
    doneBy: uuid('done_by'),
    doneNote: text('done_note'),
    // Outcome chosen when completing (for example "reached client"). Required when the type has require_result.
    result: text('result'),
    // Set when the activity was created by an activity plan run.
    planRunId: uuid('plan_run_id').references((): AnyPgColumn => activityPlanRuns.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
    index('activities_open_assignee_due_idx')
      .on(t.companyId, t.assigneeId, t.dueDate)
      .where(sql`${t.doneAt} is null`),
    index('activities_company_entity_record_idx').on(t.companyId, t.entity, t.recordId),
    index('activities_company_plan_run_idx').on(t.companyId, t.planRunId),
  ],
);

// Activity plans: a named sequence of activities launched on a record (Odoo mail.activity.plan).
export const activityPlans = pgTable(
  'activity_plans',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    name: text('name').notNull(),
    // Entity the plan can be launched on, for example crm.lead
    entity: text('entity').notNull(),
    active: boolean('active').notNull().default(true),
  },
  (t) => [index('activity_plans_company_entity_idx').on(t.companyId, t.entity)],
);

// One step of a plan. The due date is the run start date plus offset_days.
export const activityPlanSteps = pgTable(
  'activity_plan_steps',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    planId: uuid('plan_id')
      .notNull()
      .references(() => activityPlans.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    activityTypeId: uuid('activity_type_id')
      .notNull()
      .references(() => activityTypes.id),
    summary: text('summary').notNull(),
    offsetDays: integer('offset_days').notNull().default(0),
    // record_owner: the owner passed at launch. fixed: user_id.
    responsible: text('responsible').notNull().default('record_owner'),
    // FK users.id (added by integrator). Set only when responsible = fixed.
    userId: uuid('user_id'),
  },
  (t) => [
    index('activity_plan_steps_company_plan_idx').on(t.companyId, t.planId, t.sequence),
    check('activity_plan_steps_responsible_check', sql`${t.responsible} in ('record_owner', 'fixed')`),
    check(
      'activity_plan_steps_responsible_user_check',
      sql`(${t.responsible} = 'fixed') = (${t.userId} is not null)`,
    ),
  ],
);

// One launch of a plan on one record. Cancelled runs keep their row with cancelled_at set.
export const activityPlanRuns = pgTable(
  'activity_plan_runs',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    planId: uuid('plan_id')
      .notNull()
      .references(() => activityPlans.id),
    entity: text('entity').notNull(),
    recordId: uuid('record_id').notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    // FK users.id (added by integrator). Used for steps with responsible = record_owner.
    ownerId: uuid('owner_id'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  },
  (t) => [
    index('activity_plan_runs_company_entity_record_idx').on(t.companyId, t.entity, t.recordId),
  ],
);

// 3.11 followers. Tenant table. Exactly one of user_id and partner_id is set.
export const followers = pgTable(
  'followers',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    entity: text('entity').notNull(),
    recordId: uuid('record_id').notNull(),
    // FK users.id (added by integrator)
    userId: uuid('user_id'),
    // FK → partners.id (added by integrator)
    partnerId: uuid('partner_id'),
  },
  (t) => [
    index('followers_company_entity_record_idx').on(t.companyId, t.entity, t.recordId),
    uniqueIndex('followers_company_entity_record_user_key')
      .on(t.companyId, t.entity, t.recordId, t.userId)
      .where(sql`${t.userId} is not null`),
    uniqueIndex('followers_company_entity_record_partner_key')
      .on(t.companyId, t.entity, t.recordId, t.partnerId)
      .where(sql`${t.partnerId} is not null`),
    check(
      'followers_one_target_check',
      sql`(${t.userId} is null) <> (${t.partnerId} is null)`,
    ),
  ],
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type ActivityType = typeof activityTypes.$inferSelect;
export type NewActivityType = typeof activityTypes.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type ActivityPlan = typeof activityPlans.$inferSelect;
export type NewActivityPlan = typeof activityPlans.$inferInsert;
export type ActivityPlanStep = typeof activityPlanSteps.$inferSelect;
export type NewActivityPlanStep = typeof activityPlanSteps.$inferInsert;
export type ActivityPlanRun = typeof activityPlanRuns.$inferSelect;
export type Follower = typeof followers.$inferSelect;
export type NewFollower = typeof followers.$inferInsert;
