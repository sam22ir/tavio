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
  },
  (t) => [
    index('activity_types_company_entity_idx').on(t.companyId, t.entity),
    unique('activity_types_company_name_entity_key')
      .on(t.companyId, t.name, t.entity)
      .nullsNotDistinct(),
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
  },
  (t) => [
    index('activities_open_assignee_due_idx')
      .on(t.companyId, t.assigneeId, t.dueDate)
      .where(sql`${t.doneAt} is null`),
    index('activities_company_entity_record_idx').on(t.companyId, t.entity, t.recordId),
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
export type Follower = typeof followers.$inferSelect;
export type NewFollower = typeof followers.$inferInsert;
