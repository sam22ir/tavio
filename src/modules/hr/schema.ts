import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  numeric,
  pgTable,
  text,
  boolean,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
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

export const departments = pgTable(
  'departments',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    name: text('name').notNull(),
    active: boolean('active').notNull().default(true),
  },
  (t) => [index('departments_company_id_name_idx').on(t.companyId, t.name)],
);

export const employees = pgTable(
  'employees',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // FK → users.id (added by integrator). Links the employee to a login for self check-in.
    userId: uuid('user_id'),
    partnerId: uuid('partner_id').references(() => partners.id),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    jobTitle: text('job_title'),
    departmentId: uuid('department_id').references(() => departments.id),
    managerId: uuid('manager_id').references((): AnyPgColumn => employees.id),
    hireDate: date('hire_date', { mode: 'string' }),
    phone: text('phone'),
    email: text('email'),
    // National identification number. Personal data: never log it.
    nin: text('nin'),
    active: boolean('active').notNull().default(true),
  },
  (t) => [
    index('employees_company_id_active_idx').on(t.companyId, t.active),
    index('employees_company_id_department_id_idx').on(t.companyId, t.departmentId),
    index('employees_company_id_manager_id_idx').on(t.companyId, t.managerId),
    uniqueIndex('employees_company_id_user_id_key')
      .on(t.companyId, t.userId)
      .where(sql`${t.userId} is not null`),
  ],
);

export const leaveTypes = pgTable(
  'leave_types',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    name: text('name').notNull(),
    active: boolean('active').notNull().default(true),
  },
  (t) => [index('leave_types_company_id_name_idx').on(t.companyId, t.name)],
);

export const leaveRequests = pgTable(
  'leave_requests',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    typeId: uuid('type_id')
      .notNull()
      .references(() => leaveTypes.id),
    fromDate: date('from_date', { mode: 'string' }).notNull(),
    toDate: date('to_date', { mode: 'string' }).notNull(),
    days: numeric('days', { precision: 14, scale: 3 }).notNull(),
    state: text('state').notNull().default('draft'),
    reason: text('reason'),
    decidedBy: uuid('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (t) => [
    index('leave_requests_company_id_employee_id_idx').on(t.companyId, t.employeeId),
    index('leave_requests_company_id_state_idx').on(t.companyId, t.state),
    check(
      'leave_requests_state_check',
      sql`${t.state} in ('draft', 'submitted', 'approved', 'refused')`,
    ),
    check('leave_requests_dates_check', sql`${t.toDate} >= ${t.fromDate}`),
    check('leave_requests_days_check', sql`${t.days} > 0`),
  ],
);

export const attendances = pgTable(
  'attendances',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    checkIn: timestamp('check_in', { withTimezone: true }).notNull(),
    checkOut: timestamp('check_out', { withTimezone: true }),
  },
  (t) => [
    index('attendances_company_id_employee_id_check_in_idx').on(t.companyId, t.employeeId, t.checkIn),
    // At most one open attendance per employee.
    uniqueIndex('attendances_open_per_employee_key')
      .on(t.companyId, t.employeeId)
      .where(sql`${t.checkOut} is null`),
    check(
      'attendances_order_check',
      sql`${t.checkOut} is null or ${t.checkOut} >= ${t.checkIn}`,
    ),
  ],
);

export type Department = typeof departments.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type LeaveType = typeof leaveTypes.$inferSelect;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type Attendance = typeof attendances.$inferSelect;
