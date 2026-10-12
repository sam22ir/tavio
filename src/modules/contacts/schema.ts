import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { companies } from '@/core/db/schema/tenancy';

// Common columns (DATA_MODEL.md 0.1). `created_by` references users.id (FK added by integrator).
const commonColumns = () => ({
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // FK → users.id (added by integrator)
  createdBy: uuid('created_by'),
});

// Partners (DATA_MODEL.md 3.1). Customers, suppliers and prospects. Tenant table.
export const partners = pgTable(
  'partners',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // individual or company
    kind: text('kind').notNull(),
    isCustomer: boolean('is_customer').notNull().default(false),
    isSupplier: boolean('is_supplier').notNull().default(false),
    // Set by CRM leads (guess)
    isProspect: boolean('is_prospect').notNull().default(false),
    // Archive instead of delete
    active: boolean('active').notNull().default(true),
    // Computed on save: company name, or first + last name
    displayName: text('display_name').notNull(),
    // Required for individual
    firstName: text('first_name'),
    // Required for individual
    lastName: text('last_name'),
    // Required for company
    companyName: text('company_name'),
    // Tax id
    nif: text('nif'),
    // Statistical id
    nis: text('nis'),
    // Trade register, for companies
    rc: text('rc'),
    // Article d'imposition (verify)
    ai: text('ai'),
    // ID card or passport number. Encrypted at app level (AES-GCM). Never logged.
    nationalId: text('national_id'),
    // HMAC-SHA256 of normalized national_id. Used for uniqueness and lookup
    nationalIdHash: text('national_id_hash'),
    // E.164
    phone: text('phone'),
    // E.164
    phoneAlt: text('phone_alt'),
    email: text('email'),
    address: text('address'),
    // '01' to '69', from wilayas seed (l10n_dz)
    wilayaCode: text('wilaya_code'),
    // Free text in P1
    commune: text('commune'),
    // P2 scoring input
    employer: text('employer'),
    // P2 scoring input, >= 0
    monthlyIncomeCents: bigint('monthly_income_cents', { mode: 'bigint' }),
    // FK → users.id (added by integrator). Owner of the relationship
    salespersonId: uuid('salesperson_id'),
    notes: text('notes'),
    // Reserved for P8 custom fields
    custom: jsonb('custom').notNull().default({}),
  },
  (t) => [
    index('partners_company_id_active_idx').on(t.companyId, t.active),
    index('partners_company_id_display_name_idx').on(t.companyId, t.displayName),
    index('partners_company_id_phone_idx').on(t.companyId, t.phone),
    index('partners_company_id_is_customer_idx')
      .on(t.companyId, t.isCustomer)
      .where(sql`${t.isCustomer}`),
    index('partners_company_id_salesperson_id_idx').on(t.companyId, t.salespersonId),
    uniqueIndex('partners_company_id_nif_key')
      .on(t.companyId, t.nif)
      .where(sql`${t.nif} is not null`),
    uniqueIndex('partners_company_id_rc_key')
      .on(t.companyId, t.rc)
      .where(sql`${t.rc} is not null`),
    uniqueIndex('partners_company_id_nis_key')
      .on(t.companyId, t.nis)
      .where(sql`${t.nis} is not null`),
    uniqueIndex('partners_company_id_national_id_hash_key')
      .on(t.companyId, t.nationalIdHash)
      .where(sql`${t.nationalIdHash} is not null`),
    check('partners_kind_check', sql`${t.kind} in ('individual', 'company')`),
    check(
      'partners_role_check',
      sql`${t.isCustomer} or ${t.isSupplier} or ${t.isProspect}`,
    ),
    check(
      'partners_individual_names_check',
      sql`${t.kind} <> 'individual' or (${t.firstName} is not null and ${t.lastName} is not null)`,
    ),
    check(
      'partners_company_name_check',
      sql`${t.kind} <> 'company' or ${t.companyName} is not null`,
    ),
    check(
      'partners_monthly_income_check',
      sql`${t.monthlyIncomeCents} is null or ${t.monthlyIncomeCents} >= 0`,
    ),
  ],
);

// Partner contacts (DATA_MODEL.md 3.2). Persons inside a company partner. Tenant table.
export const partnerContacts = pgTable(
  'partner_contacts',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    partnerId: uuid('partner_id')
      .notNull()
      .references(() => partners.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    jobTitle: text('job_title'),
    // E.164
    phone: text('phone'),
    email: text('email'),
    isPrimary: boolean('is_primary').notNull().default(false),
  },
  (t) => [
    index('partner_contacts_company_id_partner_id_idx').on(t.companyId, t.partnerId),
    uniqueIndex('partner_contacts_partner_id_primary_key')
      .on(t.partnerId)
      .where(sql`${t.isPrimary}`),
  ],
);

export type Partner = typeof partners.$inferSelect;
export type NewPartner = typeof partners.$inferInsert;
export type PartnerContact = typeof partnerContacts.$inferSelect;
export type NewPartnerContact = typeof partnerContacts.$inferInsert;
