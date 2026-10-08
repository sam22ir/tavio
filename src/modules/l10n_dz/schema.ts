import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  date,
  index,
  numeric,
  pgTable,
  smallint,
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
  // references users.id (FK added by integrator)
  createdBy: uuid('created_by'),
});

// Currencies (DATA_MODEL.md 3.6). Global reference table, no company_id. Written by migrations only.
export const currencies = pgTable(
  'currencies',
  {
    ...commonColumns(),
    code: char('code', { length: 3 }).notNull(),
    name: text('name').notNull(),
    symbol: text('symbol').notNull(),
    decimals: smallint('decimals').notNull(),
    active: boolean('active').notNull().default(true),
  },
  (t) => [uniqueIndex('currencies_code_key').on(t.code)],
);

// Taxes (DATA_MODEL.md 3.7). Tenant table, seeded from DZ_TAX_DEFAULTS when a company is created.
export const taxes = pgTable(
  'taxes',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // TVA19, TVA9, TVA0, EXO, and so on
    code: text('code').notNull(),
    name: text('name').notNull(),
    // vat, stamp, other. Only vat in P1
    kind: text('kind').notNull(),
    // percent, 19.0000 for 19%
    rate: numeric('rate', { precision: 7, scale: 4 }).notNull(),
    // sale, purchase, both
    scope: text('scope').notNull(),
    // first day this rate applies
    validFrom: date('valid_from').notNull(),
    // last day, inclusive. Null = open
    validTo: date('valid_to'),
    active: boolean('active').notNull().default(true),
    // citation of the source law. Verify
    legalRef: text('legal_ref'),
    isDefaultSale: boolean('is_default_sale').notNull().default(false),
    isDefaultPurchase: boolean('is_default_purchase').notNull().default(false),
  },
  (t) => [
    index('taxes_company_id_code_valid_from_idx').on(t.companyId, t.code, t.validFrom),
    index('taxes_company_id_scope_active_idx').on(t.companyId, t.scope, t.active),
    uniqueIndex('taxes_company_id_code_valid_from_key').on(t.companyId, t.code, t.validFrom),
    check('taxes_valid_to_check', sql`${t.validTo} is null or ${t.validTo} >= ${t.validFrom}`),
    check('taxes_rate_check', sql`${t.rate} >= 0`),
    check('taxes_kind_check', sql`${t.kind} in ('vat', 'stamp', 'other')`),
    check('taxes_scope_check', sql`${t.scope} in ('sale', 'purchase', 'both')`),
    // Exclusion constraint (no overlapping [valid_from, valid_to] per company_id + code)
    // needs btree_gist and is added in the migration, not expressible here. **(guess)**
  ],
);

export type Currency = typeof currencies.$inferSelect;
export type NewCurrency = typeof currencies.$inferInsert;
export type Tax = typeof taxes.$inferSelect;
export type NewTax = typeof taxes.$inferInsert;
