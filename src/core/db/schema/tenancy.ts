import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Common columns (DATA_MODEL.md 0.1). `created_by` references users.id, but the
// auth tables are not imported here. The integrator adds the FK to users.id.
const commonColumns = () => ({
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // references users.id (FK added by integrator)
  createdBy: uuid('created_by'),
});

// Tenant root (DATA_MODEL.md 2.2). Not a tenant table: no company_id.
export const companies = pgTable(
  'companies',
  {
    ...commonColumns(),
    legalName: text('legal_name').notNull(),
    displayName: text('display_name').notNull(),
    nif: text('nif'),
    nis: text('nis'),
    rc: text('rc'),
    ai: text('ai'),
    address: text('address'),
    // references wilayas seed, '01' to '58'
    wilayaCode: text('wilaya_code'),
    commune: text('commune'),
    // E.164
    phone: text('phone'),
    email: text('email'),
    // FK files (added by integrator / files table)
    logoFileId: uuid('logo_file_id'),
    defaultLocale: text('default_locale').notNull().default('fr'),
    timezone: text('timezone').notNull().default('Africa/Algiers'),
    // FK-style reference to currencies.code
    currencyCode: text('currency_code').notNull().default('DZD'),
    fiscalYearStartMonth: smallint('fiscal_year_start_month').notNull().default(1),
    plan: text('plan').notNull().default('saas_starter'),
    status: text('status').notNull().default('active'),
    // Onboarding choice: 'commerce' | 'wholesale' | 'services' | 'other'. Null until chosen.
    businessType: text('business_type'),
  },
  (t) => [
    index('companies_status_idx').on(t.status),
    uniqueIndex('companies_nif_key').on(t.nif).where(sql`${t.nif} is not null`),
    uniqueIndex('companies_rc_key').on(t.rc).where(sql`${t.rc} is not null`),
    check('companies_status_check', sql`${t.status} in ('active', 'suspended', 'closed')`),
    check('companies_default_locale_check', sql`${t.defaultLocale} in ('fr', 'ar', 'en')`),
    check(
      'companies_fiscal_year_start_month_check',
      sql`${t.fiscalYearStartMonth} between 1 and 12`,
    ),
    check('companies_plan_check', sql`${t.plan} in ('onprem', 'saas_starter', 'saas_pro')`),
  ],
);

// Roles (DATA_MODEL.md 2.4). Tenant table.
export const roles = pgTable(
  'roles',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // owner, admin, manager, staff, or custom slug
    key: text('key').notNull(),
    name: text('name').notNull(),
    isSystem: boolean('is_system').notNull(),
    description: text('description'),
  },
  (t) => [
    index('roles_company_id_idx').on(t.companyId),
    uniqueIndex('roles_company_id_key_key').on(t.companyId, t.key),
  ],
);

// Memberships (DATA_MODEL.md 2.3). Tenant table.
export const memberships = pgTable(
  'memberships',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // references users.id (FK added by integrator)
    userId: uuid('user_id').notNull(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    status: text('status').notNull().default('invited'),
    invitedEmail: text('invited_email'),
    // hashed, cleared on accept
    inviteTokenHash: text('invite_token_hash'),
    inviteExpiresAt: timestamp('invite_expires_at', { withTimezone: true }),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
    // Default record rule for staff (guess in DATA_MODEL.md)
    recordScope: text('record_scope').notNull().default('company'),
  },
  (t) => [
    index('memberships_company_id_status_idx').on(t.companyId, t.status),
    index('memberships_user_id_idx').on(t.userId),
    index('memberships_company_id_role_id_idx').on(t.companyId, t.roleId),
    uniqueIndex('memberships_company_id_user_id_key').on(t.companyId, t.userId),
    check(
      'memberships_status_check',
      sql`${t.status} in ('invited', 'active', 'suspended', 'left')`,
    ),
    check('memberships_record_scope_check', sql`${t.recordScope} in ('company', 'own')`),
  ],
);

// Role permissions (DATA_MODEL.md 2.5). Tenant table.
export const rolePermissions = pgTable(
  'role_permissions',
  {
    ...commonColumns(),
    // Denormalized from roles for RLS
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    // e.g. 'crm.lead.write'. Checked against the permission registry in the service layer
    permission: text('permission').notNull(),
  },
  (t) => [
    index('role_permissions_company_id_role_id_idx').on(t.companyId, t.roleId),
    uniqueIndex('role_permissions_role_id_permission_key').on(t.roleId, t.permission),
  ],
);

// Company modules (DATA_MODEL.md 2.6). Tenant table.
export const companyModules = pgTable(
  'company_modules',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // matches manifest id, e.g. 'credit_sales'
    moduleId: text('module_id').notNull(),
    // module version at enable time
    version: text('version').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    enabledAt: timestamp('enabled_at', { withTimezone: true }),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
  },
  (t) => [
    index('company_modules_company_id_enabled_idx').on(t.companyId, t.enabled),
    uniqueIndex('company_modules_company_id_module_id_key').on(t.companyId, t.moduleId),
  ],
);

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
export type CompanyModule = typeof companyModules.$inferSelect;
export type NewCompanyModule = typeof companyModules.$inferInsert;
