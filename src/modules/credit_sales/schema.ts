import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { companies } from '@/core/db/schema/tenancy';

// Credit sales tables (DATA_MODEL.md sections 4.1 to 4.8).
// Cross-module FKs (partners, products, uoms, taxes, leads, files, users) are
// comments only: the integrator adds them. Money is bigint centimes.

const commonColumns = () => ({
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // references users.id (FK added by integrator)
  createdBy: uuid('created_by'),
});

// 4.1 contracts
export const creditContracts = pgTable(
  'contracts',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    reference: text('reference').notNull(),
    // FK → partners.id (added by integrator)
    partnerId: uuid('partner_id').notNull(),
    // FK → leads.id (added by integrator)
    leadId: uuid('lead_id'),
    state: text('state').notNull().default('draft'),
    // FK → users.id (added by integrator)
    salespersonId: uuid('salesperson_id'),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    frequency: text('frequency').notNull(),
    installmentsCount: integer('installments_count').notNull(),
    cashPriceCents: bigint('cash_price_cents', { mode: 'bigint' }).notNull(),
    markupRate: numeric('markup_rate', { precision: 7, scale: 4 }).notNull().default('0'),
    markupCents: bigint('markup_cents', { mode: 'bigint' }).notNull(),
    totalCents: bigint('total_cents', { mode: 'bigint' }).notNull(),
    downPaymentCents: bigint('down_payment_cents', { mode: 'bigint' }).notNull(),
    financedCents: bigint('financed_cents', { mode: 'bigint' }).notNull(),
    downPaymentPaidCents: bigint('down_payment_paid_cents', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: text('cancel_reason'),
    defaultedAt: timestamp('defaulted_at', { withTimezone: true }),
    notes: text('notes'),
    // FK → files.id (added by integrator)
    pdfFileId: uuid('pdf_file_id'),
  },
  (t) => [
    index('credit_sales_contracts_company_state_idx').on(t.companyId, t.state),
    index('credit_sales_contracts_company_partner_idx').on(t.companyId, t.partnerId),
    index('credit_sales_contracts_company_start_idx').on(t.companyId, t.startDate),
    index('credit_sales_contracts_company_salesperson_idx').on(t.companyId, t.salespersonId),
    uniqueIndex('credit_sales_contracts_company_reference_key').on(t.companyId, t.reference),
    check(
      'credit_sales_contracts_state_check',
      sql`${t.state} in ('draft', 'active', 'completed', 'cancelled', 'defaulted')`,
    ),
    check(
      'credit_sales_contracts_frequency_check',
      sql`${t.frequency} in ('monthly', 'weekly')`,
    ),
    check('credit_sales_contracts_installments_count_check', sql`${t.installmentsCount} > 0`),
    check('credit_sales_contracts_cash_price_check', sql`${t.cashPriceCents} >= 0`),
    check('credit_sales_contracts_markup_rate_check', sql`${t.markupRate} >= 0`),
    check('credit_sales_contracts_markup_check', sql`${t.markupCents} >= 0`),
    check('credit_sales_contracts_down_payment_check', sql`${t.downPaymentCents} >= 0`),
    check(
      'credit_sales_contracts_down_payment_max_check',
      sql`${t.downPaymentCents} <= ${t.totalCents}`,
    ),
    check(
      'credit_sales_contracts_total_check',
      sql`${t.totalCents} = ${t.cashPriceCents} + ${t.markupCents}`,
    ),
    check(
      'credit_sales_contracts_financed_check',
      sql`${t.financedCents} = ${t.totalCents} - ${t.downPaymentCents} and ${t.financedCents} >= 0`,
    ),
    check(
      'credit_sales_contracts_cancelled_at_check',
      sql`${t.state} <> 'cancelled' or ${t.cancelledAt} is not null`,
    ),
  ],
);

// 4.2 contract_lines
export const creditContractLines = pgTable(
  'contract_lines',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    contractId: uuid('contract_id')
      .notNull()
      .references(() => creditContracts.id, { onDelete: 'cascade' }),
    lineNo: integer('line_no').notNull(),
    // FK → products.id (added by integrator). Null for free-text lines
    productId: uuid('product_id'),
    description: text('description').notNull(),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
    // FK → uoms.id (added by integrator)
    uomId: uuid('uom_id'),
    unitPriceCents: bigint('unit_price_cents', { mode: 'bigint' }).notNull(),
    lineTotalCents: bigint('line_total_cents', { mode: 'bigint' }).notNull(),
    // FK → taxes.id (added by integrator)
    taxId: uuid('tax_id'),
    taxCents: bigint('tax_cents', { mode: 'bigint' }).notNull().default(sql`0`),
  },
  (t) => [
    index('credit_sales_contract_lines_company_product_idx').on(t.companyId, t.productId),
    index('credit_sales_contract_lines_contract_idx').on(t.contractId),
    uniqueIndex('credit_sales_contract_lines_contract_line_no_key').on(t.contractId, t.lineNo),
    check('credit_sales_contract_lines_line_no_check', sql`${t.lineNo} >= 1`),
    check('credit_sales_contract_lines_quantity_check', sql`${t.quantity} > 0`),
    check('credit_sales_contract_lines_unit_price_check', sql`${t.unitPriceCents} >= 0`),
    check('credit_sales_contract_lines_line_total_check', sql`${t.lineTotalCents} >= 0`),
    check('credit_sales_contract_lines_tax_check', sql`${t.taxCents} >= 0`),
  ],
);

// 4.3 installments. Status is derived, never stored.
export const creditInstallments = pgTable(
  'installments',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    contractId: uuid('contract_id')
      .notNull()
      .references(() => creditContracts.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    dueDate: date('due_date', { mode: 'string' }).notNull(),
    amountCents: bigint('amount_cents', { mode: 'bigint' }).notNull(),
    paidCents: bigint('paid_cents', { mode: 'bigint' }).notNull().default(sql`0`),
    lastPaidAt: timestamp('last_paid_at', { withTimezone: true }),
  },
  (t) => [
    index('credit_sales_installments_company_due_idx')
      .on(t.companyId, t.dueDate)
      .where(sql`${t.paidCents} < ${t.amountCents}`),
    index('credit_sales_installments_company_contract_idx').on(t.companyId, t.contractId),
    uniqueIndex('credit_sales_installments_contract_seq_key').on(t.contractId, t.seq),
    check('credit_sales_installments_seq_check', sql`${t.seq} >= 1`),
    check('credit_sales_installments_amount_check', sql`${t.amountCents} > 0`),
    check(
      'credit_sales_installments_paid_check',
      sql`${t.paidCents} >= 0 and ${t.paidCents} <= ${t.amountCents}`,
    ),
  ],
);

// 4.4 payments
export const creditPayments = pgTable(
  'payments',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    reference: text('reference').notNull(),
    // FK → partners.id (added by integrator)
    partnerId: uuid('partner_id').notNull(),
    state: text('state').notNull().default('posted'),
    method: text('method').notNull(),
    amountCents: bigint('amount_cents', { mode: 'bigint' }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    // FK → users.id (added by integrator)
    receivedBy: uuid('received_by').notNull(),
    externalRef: text('external_ref'),
    bankName: text('bank_name'),
    chequeDueDate: date('cheque_due_date', { mode: 'string' }),
    reversalOfId: uuid('reversal_of_id').references((): AnyPgColumn => creditPayments.id),
    reversedById: uuid('reversed_by_id').references((): AnyPgColumn => creditPayments.id),
    note: text('note'),
  },
  (t) => [
    index('credit_sales_payments_company_partner_received_idx').on(
      t.companyId,
      t.partnerId,
      t.receivedAt,
    ),
    index('credit_sales_payments_company_method_received_idx').on(
      t.companyId,
      t.method,
      t.receivedAt,
    ),
    index('credit_sales_payments_company_state_idx').on(t.companyId, t.state),
    uniqueIndex('credit_sales_payments_company_reference_key').on(t.companyId, t.reference),
    uniqueIndex('credit_sales_payments_company_method_external_ref_key')
      .on(t.companyId, t.method, t.externalRef)
      .where(sql`${t.externalRef} is not null and ${t.state} = 'posted'`),
    check(
      'credit_sales_payments_method_check',
      sql`${t.method} in ('cash', 'ccp', 'transfer', 'cib', 'edahabia', 'cheque')`,
    ),
    check('credit_sales_payments_state_check', sql`${t.state} in ('posted', 'reversed')`),
    check('credit_sales_payments_amount_check', sql`${t.amountCents} > 0`),
    check(
      'credit_sales_payments_cheque_due_date_check',
      sql`${t.method} <> 'cheque' or ${t.chequeDueDate} is not null`,
    ),
  ],
);

// 4.5 payment_allocations. Append-only.
export const creditPaymentAllocations = pgTable(
  'payment_allocations',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => creditPayments.id),
    installmentId: uuid('installment_id').references(() => creditInstallments.id),
    contractId: uuid('contract_id').references(() => creditContracts.id),
    amountCents: bigint('amount_cents', { mode: 'bigint' }).notNull(),
  },
  (t) => [
    index('credit_sales_payment_allocations_company_payment_idx').on(t.companyId, t.paymentId),
    index('credit_sales_payment_allocations_company_installment_idx').on(
      t.companyId,
      t.installmentId,
    ),
    index('credit_sales_payment_allocations_company_contract_idx').on(t.companyId, t.contractId),
    check('credit_sales_payment_allocations_amount_check', sql`${t.amountCents} > 0`),
    check(
      'credit_sales_payment_allocations_target_check',
      sql`num_nonnulls(${t.installmentId}, ${t.contractId}) = 1`,
    ),
  ],
);

// 4.6 receipts
export const creditReceipts = pgTable(
  'receipts',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    number: text('number').notNull(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => creditPayments.id),
    // FK → partners.id (added by integrator). Copied from payment
    partnerId: uuid('partner_id').notNull(),
    state: text('state').notNull().default('issued'),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
    totalCents: bigint('total_cents', { mode: 'bigint' }).notNull(),
    // FK → files.id (added by integrator)
    pdfFileId: uuid('pdf_file_id'),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidReason: text('void_reason'),
  },
  (t) => [
    index('credit_sales_receipts_company_issued_idx').on(t.companyId, t.issuedAt),
    index('credit_sales_receipts_company_partner_idx').on(t.companyId, t.partnerId),
    uniqueIndex('credit_sales_receipts_company_number_key').on(t.companyId, t.number),
    uniqueIndex('credit_sales_receipts_payment_id_key').on(t.paymentId),
    check('credit_sales_receipts_state_check', sql`${t.state} in ('issued', 'voided')`),
    check('credit_sales_receipts_total_check', sql`${t.totalCents} > 0`),
    check(
      'credit_sales_receipts_void_check',
      sql`${t.state} <> 'voided' or (${t.voidedAt} is not null and ${t.voidReason} is not null)`,
    ),
  ],
);

// 4.7 guarantors
export const creditGuarantors = pgTable(
  'guarantors',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    contractId: uuid('contract_id')
      .notNull()
      .references(() => creditContracts.id, { onDelete: 'cascade' }),
    // FK → partners.id (added by integrator). The guarantor
    partnerId: uuid('partner_id').notNull(),
    relation: text('relation'),
    consentAt: timestamp('consent_at', { withTimezone: true }).notNull(),
    consentTextVersion: text('consent_text_version').notNull(),
    // FK → files.id (added by integrator), kind id_photo
    idPhotoFileId: uuid('id_photo_file_id'),
    // FK → files.id (added by integrator)
    signedFileId: uuid('signed_file_id'),
  },
  (t) => [
    index('credit_sales_guarantors_company_contract_idx').on(t.companyId, t.contractId),
    index('credit_sales_guarantors_company_partner_idx').on(t.companyId, t.partnerId),
    uniqueIndex('credit_sales_guarantors_contract_partner_key').on(t.contractId, t.partnerId),
  ],
);

// 4.8 client_scores. Append-only. Latest row is the current score.
export const creditClientScores = pgTable(
  'client_scores',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // FK → partners.id (added by integrator)
    partnerId: uuid('partner_id').notNull(),
    contractId: uuid('contract_id').references(() => creditContracts.id),
    score: integer('score').notNull(),
    band: text('band').notNull(),
    method: text('method').notNull().default('rules'),
    inputs: jsonb('inputs').notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull(),
    // FK → users.id (added by integrator)
    acceptedBy: uuid('accepted_by'),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  },
  (t) => [
    index('credit_sales_client_scores_company_partner_computed_idx').on(
      t.companyId,
      t.partnerId,
      sql`${t.computedAt} desc`,
    ),
    index('credit_sales_client_scores_company_band_idx').on(t.companyId, t.band),
    check(
      'credit_sales_client_scores_score_check',
      sql`${t.score} between 0 and 100`,
    ),
    check('credit_sales_client_scores_band_check', sql`${t.band} in ('A', 'B', 'C', 'D', 'E')`),
    check(
      'credit_sales_client_scores_method_check',
      sql`${t.method} in ('rules', 'manual', 'ai_suggested')`,
    ),
  ],
);

export type CreditContract = typeof creditContracts.$inferSelect;
export type NewCreditContract = typeof creditContracts.$inferInsert;
export type CreditContractLine = typeof creditContractLines.$inferSelect;
export type NewCreditContractLine = typeof creditContractLines.$inferInsert;
export type CreditInstallment = typeof creditInstallments.$inferSelect;
export type NewCreditInstallment = typeof creditInstallments.$inferInsert;
export type CreditPayment = typeof creditPayments.$inferSelect;
export type NewCreditPayment = typeof creditPayments.$inferInsert;
export type CreditPaymentAllocation = typeof creditPaymentAllocations.$inferSelect;
export type NewCreditPaymentAllocation = typeof creditPaymentAllocations.$inferInsert;
export type CreditReceipt = typeof creditReceipts.$inferSelect;
export type NewCreditReceipt = typeof creditReceipts.$inferInsert;
export type CreditGuarantor = typeof creditGuarantors.$inferSelect;
export type NewCreditGuarantor = typeof creditGuarantors.$inferInsert;
export type CreditClientScore = typeof creditClientScores.$inferSelect;
export type NewCreditClientScore = typeof creditClientScores.$inferInsert;
