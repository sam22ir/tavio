import { sql } from 'drizzle-orm';
import { check, date, index, integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
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

// Projects. Tenant table.
export const projects = pgTable(
  'projects',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    name: text('name').notNull(),
    partnerId: uuid('partner_id').references(() => partners.id),
    // FK → users.id (integrator)
    managerId: uuid('manager_id'),
    state: text('state').notNull().default('active'),
  },
  (t) => [
    index('projects_company_id_state_idx').on(t.companyId, t.state),
    index('projects_company_id_partner_id_idx').on(t.companyId, t.partnerId),
    check('projects_state_check', sql`${t.state} in ('active', 'done', 'archived')`),
  ],
);

// Kanban stages, one set per project. Tenant table.
export const projectStages = pgTable(
  'project_stages',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sequence: integer('sequence').notNull().default(0),
  },
  (t) => [index('project_stages_company_id_project_id_idx').on(t.companyId, t.projectId)],
);

// Tasks. Tenant table.
export const projectTasks = pgTable(
  'project_tasks',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => projectStages.id),
    name: text('name').notNull(),
    // FK → users.id (integrator)
    assigneeId: uuid('assignee_id'),
    priority: text('priority').notNull().default('normal'),
    deadline: date('deadline', { mode: 'string' }),
    description: text('description'),
  },
  (t) => [
    index('project_tasks_company_id_project_id_idx').on(t.companyId, t.projectId),
    index('project_tasks_company_id_stage_id_idx').on(t.companyId, t.stageId),
    index('project_tasks_company_id_assignee_id_idx').on(t.companyId, t.assigneeId),
    check('project_tasks_priority_check', sql`${t.priority} in ('low', 'normal', 'high', 'urgent')`),
  ],
);

// Timesheets: hours logged against a task. Tenant table.
export const timesheets = pgTable(
  'timesheets',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    taskId: uuid('task_id')
      .notNull()
      .references(() => projectTasks.id, { onDelete: 'cascade' }),
    // FK → users.id (integrator)
    userId: uuid('user_id').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    hours: numeric('hours', { precision: 7, scale: 2 }).notNull(),
    description: text('description'),
  },
  (t) => [
    index('timesheets_company_id_user_id_date_idx').on(t.companyId, t.userId, t.date),
    index('timesheets_company_id_task_id_idx').on(t.companyId, t.taskId),
    check('timesheets_hours_check', sql`${t.hours} > 0 and ${t.hours} <= 24`),
  ],
);

export type Project = typeof projects.$inferSelect;
export type ProjectStage = typeof projectStages.$inferSelect;
export type ProjectTask = typeof projectTasks.$inferSelect;
export type Timesheet = typeof timesheets.$inferSelect;
