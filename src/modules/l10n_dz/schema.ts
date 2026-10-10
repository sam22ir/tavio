import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  jsonb,
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
    // tva, tap, retenue_source, other (see TAX_KINDS in data.ts)
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
    // Account the tax is posted to: collected on sales, deductible or withheld on purchases.
    // Seeded as 4457/4456 for TVA and 447 for other taxes. Account seed to be checked by the accountant.
    saleAccountCode: text('sale_account_code').notNull().default('447'),
    purchaseAccountCode: text('purchase_account_code').notNull().default('447'),
  },
  (t) => [
    index('taxes_company_id_code_valid_from_idx').on(t.companyId, t.code, t.validFrom),
    index('taxes_company_id_scope_active_idx').on(t.companyId, t.scope, t.active),
    uniqueIndex('taxes_company_id_code_valid_from_key').on(t.companyId, t.code, t.validFrom),
    check('taxes_valid_to_check', sql`${t.validTo} is null or ${t.validTo} >= ${t.validFrom}`),
    check('taxes_rate_check', sql`${t.rate} >= 0`),
    check('taxes_kind_check', sql`${t.kind} in ('tva', 'tap', 'retenue_source', 'other')`),
    check('taxes_scope_check', sql`${t.scope} in ('sale', 'purchase', 'both')`),
    // Exclusion constraint (no overlapping [valid_from, valid_to] per company_id + code)
    // needs btree_gist and is added in the migration, not expressible here. **(guess)**
  ],
);

export type Currency = typeof currencies.$inferSelect;
export type NewCurrency = typeof currencies.$inferInsert;
export type Tax = typeof taxes.$inferSelect;
export type NewTax = typeof taxes.$inferInsert;

// Company tax settings (one row per company, defaults apply when absent). Tenant table.
export const l10nSettings = pgTable(
  'l10n_dz_settings',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // reel = régime réel (standard), ifu = impôt forfaitaire unique (simplified flat-rate). ⚠ accountant
    taxRegime: text('tax_regime').notNull().default('reel'),
    // Payment methods that trigger stamp duty on a sales invoice payment. Default cash only. ⚠ accountant
    stampMethods: text('stamp_methods').array().notNull().default(sql`'{cash}'`),
  },
  (t) => [
    uniqueIndex('l10n_dz_settings_company_id_key').on(t.companyId),
    check('l10n_dz_settings_tax_regime_check', sql`${t.taxRegime} in ('reel', 'ifu')`),
  ],
);

// Stamp duty tiers, ordered by sort_order ascending. The last tier has up_to_da null. ⚠ accountant
export const l10nStampTiers = pgTable(
  'l10n_dz_stamp_tiers',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    sortOrder: smallint('sort_order').notNull(),
    // Tier applies while the amount in whole DA is below this value. Null = no upper bound.
    upToDa: bigint('up_to_da', { mode: 'bigint' }),
    // fixed = fixed_cents; rate = rate_percent of the amount
    mode: text('mode').notNull(),
    fixedCents: bigint('fixed_cents', { mode: 'bigint' }).notNull().default(sql`0`),
    ratePercent: numeric('rate_percent', { precision: 7, scale: 4 }).notNull().default('0'),
  },
  (t) => [
    uniqueIndex('l10n_dz_stamp_tiers_company_id_sort_order_key').on(t.companyId, t.sortOrder),
    check('l10n_dz_stamp_tiers_mode_check', sql`${t.mode} in ('fixed', 'rate')`),
    check('l10n_dz_stamp_tiers_fixed_check', sql`${t.fixedCents} >= 0`),
  ],
);

export interface G50Figures {
  period: { from: string; to: string };
  // Bigints are stored as decimal strings in JSON
  collectedCents: string;
  deductibleCents: string;
  netDueCents: string;
  stampCents: string;
  /** Retenue à la source (447) withheld from suppliers this month, shown apart from VAT. Absent on older drafts. ⚠ needs accountant verification */
  withholdingCents?: string;
  needsAccountantReview: true;
}

// Monthly G50 VAT declarations. Draft is recomputed by Préparer, validated locks the month. Tenant table.
export const g50Declarations = pgTable(
  'g50_declarations',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    year: smallint('year').notNull(),
    month: smallint('month').notNull(),
    state: text('state').notNull().default('draft'),
    figures: jsonb('figures').$type<G50Figures>().notNull(),
    validatedBy: uuid('validated_by'),
    validatedAt: timestamp('validated_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('g50_declarations_company_id_year_month_key').on(t.companyId, t.year, t.month),
    check('g50_declarations_month_check', sql`${t.month} between 1 and 12`),
    check('g50_declarations_state_check', sql`${t.state} in ('draft', 'validated')`),
    check('g50_declarations_validated_check', sql`${t.state} = 'draft' or ${t.validatedAt} is not null`),
  ],
);

export type L10nSettings = typeof l10nSettings.$inferSelect;
export type L10nStampTier = typeof l10nStampTiers.$inferSelect;
export type G50Declaration = typeof g50Declarations.$inferSelect;
