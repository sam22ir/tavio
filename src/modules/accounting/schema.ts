import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
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

// Chart of accounts (SCF). Tenant table.
export const accounts = pgTable(
  'gl_accounts',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    code: text('code').notNull(),
    name: text('name').notNull(),
    // SCF class 1–7
    accountClass: integer('account_class').notNull(),
    type: text('type').notNull(),
    reconcilable: boolean('reconcilable').notNull().default(false),
    // Parent class or account prefix, e.g. '60' for '601'. Display and grouping only.
    parentCode: text('parent_code'),
    // Archived accounts stay in place; archiving is refused once the account has journal lines.
    archived: boolean('archived').notNull().default(false),
  },
  (t) => [
    uniqueIndex('accounts_company_id_code_key').on(t.companyId, t.code),
    index('accounts_company_id_type_idx').on(t.companyId, t.type),
    check('accounts_class_check', sql`${t.accountClass} between 1 and 7`),
    check(
      'accounts_type_check',
      sql`${t.type} in ('asset', 'liability', 'equity', 'income', 'expense')`,
    ),
  ],
);

// Journals. Tenant table.
export const journals = pgTable(
  'journals',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    code: text('code').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull(),
  },
  (t) => [
    uniqueIndex('journals_company_id_code_key').on(t.companyId, t.code),
    check(
      'journals_type_check',
      // 'general' is the legacy name of 'misc' (the OD seed). Both are accepted.
      sql`${t.type} in ('sale', 'purchase', 'cash', 'bank', 'misc', 'general')`,
    ),
  ],
);

// Journal entries. Posted entries are immutable; corrections go through reverseEntry. Tenant table.
export const journalEntries = pgTable(
  'journal_entries',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // Gap-free per journal via nextNumber, e.g. 'VT/2026/00001'
    number: text('number').notNull(),
    journalId: uuid('journal_id')
      .notNull()
      .references(() => journals.id),
    date: date('date', { mode: 'string' }).notNull(),
    ref: text('ref'),
    // Source document, e.g. 'invoicing.invoice', 'invoicing.payment', 'pos.order', 'accounting.reversal'
    sourceEntity: text('source_entity'),
    sourceId: uuid('source_id'),
    state: text('state').notNull().default('posted'),
    // Set on the original entry when a reversal is posted. Self-reference, no FK in Drizzle to keep the cycle simple.
    reversedById: uuid('reversed_by_id'),
  },
  (t) => [
    uniqueIndex('journal_entries_company_id_journal_id_number_key').on(t.companyId, t.journalId, t.number),
    // Idempotency for event-driven entries: one entry per source document.
    uniqueIndex('journal_entries_company_id_source_key')
      .on(t.companyId, t.sourceEntity, t.sourceId)
      .where(sql`${t.sourceId} is not null`),
    index('journal_entries_company_id_date_idx').on(t.companyId, t.date),
    check('journal_entries_state_check', sql`${t.state} in ('draft', 'posted')`),
  ],
);

// Journal lines. Exactly one side is > 0. Tenant table.
export const journalLines = pgTable(
  'journal_lines',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    entryId: uuid('entry_id')
      .notNull()
      .references(() => journalEntries.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    partnerId: uuid('partner_id').references(() => partners.id),
    label: text('label'),
    debitCents: bigint('debit_cents', { mode: 'bigint' }).notNull().default(sql`0`),
    creditCents: bigint('credit_cents', { mode: 'bigint' }).notNull().default(sql`0`),
  },
  (t) => [
    index('journal_lines_company_id_entry_id_idx').on(t.companyId, t.entryId),
    index('journal_lines_company_id_account_id_idx').on(t.companyId, t.accountId),
    index('journal_lines_company_id_partner_id_idx').on(t.companyId, t.partnerId),
    check(
      'journal_lines_one_side_check',
      sql`${t.debitCents} >= 0 and ${t.creditCents} >= 0 and ((${t.debitCents} > 0) <> (${t.creditCents} > 0))`,
    ),
  ],
);

// Fiscal years. A closed year rejects postings (see service/fiscal.ts). Tenant table.
export const fiscalYears = pgTable(
  'fiscal_years',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    name: text('name').notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }).notNull(),
    state: text('state').notNull().default('open'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('fiscal_years_company_id_start_date_key').on(t.companyId, t.startDate),
    check('fiscal_years_state_check', sql`${t.state} in ('open', 'closed')`),
    check('fiscal_years_range_check', sql`${t.endDate} >= ${t.startDate}`),
  ],
);

// Per-company accounting settings. lockDate: no posting on or before it (null = no lock). Tenant table.
export const accountingSettings = pgTable(
  'accounting_settings',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    lockDate: date('lock_date', { mode: 'string' }),
  },
  (t) => [uniqueIndex('accounting_settings_company_id_key').on(t.companyId)],
);

export type Account = typeof accounts.$inferSelect;
export type FiscalYear = typeof fiscalYears.$inferSelect;
export type Journal = typeof journals.$inferSelect;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type JournalLine = typeof journalLines.$inferSelect;
