import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { companies } from '@/core/db/schema/tenancy';
import { partners } from '@/modules/contacts/schema';
import { taxes } from '@/modules/l10n_dz/schema';

// Common columns (DATA_MODEL.md 0.1). `created_by` references users.id (FK added by integrator).
const commonColumns = () => ({
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // FK → users.id (added by integrator)
  createdBy: uuid('created_by'),
});

const INVOICE_TYPES = ['out_invoice', 'out_refund', 'in_invoice', 'in_refund'] as const;
const PAYMENT_METHODS = ['cash', 'ccp', 'transfer', 'cib', 'edahabia', 'cheque'] as const;

export const invoices = pgTable(
  'invoices',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    type: text('type').notNull(),
    // Null until posted. Gap-free per type and year.
    number: text('number'),
    partnerId: uuid('partner_id')
      .notNull()
      .references(() => partners.id),
    state: text('state').notNull().default('draft'),
    date: date('date').notNull(),
    dueDate: date('due_date'),
    origin: text('origin'),
    sourceEntity: text('source_entity'),
    // FK → sale_orders.id / purchase_orders.id (integrator). Not a schema import, by rule.
    sourceId: uuid('source_id'),
    refundOfId: uuid('refund_of_id'),
    untaxedCents: bigint('untaxed_cents', { mode: 'bigint' }).notNull().default(sql`0`),
    taxCents: bigint('tax_cents', { mode: 'bigint' }).notNull().default(sql`0`),
    // Timbre fiscal, computed at cash payment time. ⚠ needs accountant verification
    stampCents: bigint('stamp_cents', { mode: 'bigint' }).notNull().default(sql`0`),
    totalCents: bigint('total_cents', { mode: 'bigint' }).notNull().default(sql`0`),
    paidCents: bigint('paid_cents', { mode: 'bigint' }).notNull().default(sql`0`),
    paymentState: text('payment_state').notNull().default('not_paid'),
    // Retenue à la source on a vendor bill: a retenue_source tax, its rate copied at creation, and the amount on the untaxed base.
    // It reduces what is payable to the supplier; totalCents stays the gross bill. ⚠ needs accountant verification
    withholdingTaxId: uuid('withholding_tax_id').references(() => taxes.id),
    withholdingRate: numeric('withholding_rate', { precision: 7, scale: 4 }).notNull().default('0'),
    withholdingCents: bigint('withholding_cents', { mode: 'bigint' }).notNull().default(sql`0`),
  },
  (t) => [
    index('invoices_company_id_type_state_idx').on(t.companyId, t.type, t.state),
    index('invoices_company_id_partner_id_idx').on(t.companyId, t.partnerId),
    check('invoices_type_check', sql`${t.type} in ('out_invoice','out_refund','in_invoice','in_refund')`),
    check('invoices_state_check', sql`${t.state} in ('draft','posted','cancelled')`),
    check('invoices_payment_state_check', sql`${t.paymentState} in ('not_paid','partial','paid')`),
    check('invoices_totals_check', sql`${t.totalCents} >= 0 and ${t.paidCents} >= 0`),
    check('invoices_withholding_check', sql`${t.withholdingCents} >= 0`),
  ],
);

export const invoiceLines = pgTable(
  'invoice_lines',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull().default(10),
    // FK → products.id (integrator). Not a schema import, by rule.
    productId: uuid('product_id'),
    description: text('description').notNull(),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
    unitPriceCents: bigint('unit_price_cents', { mode: 'bigint' }).notNull(),
    // Line discount in percent (0..100, 4 decimals), same representation as sale_order_lines.discount_rate.
    discountRate: numeric('discount_rate', { precision: 7, scale: 4 }).notNull().default('0'),
    taxId: uuid('tax_id').references(() => taxes.id),
    // Rate copied from the tax at posting time, so later rate changes do not alter history.
    taxRate: numeric('tax_rate', { precision: 7, scale: 4 }).notNull().default('0'),
    subtotalCents: bigint('subtotal_cents', { mode: 'bigint' }).notNull(),
    taxCents: bigint('tax_cents', { mode: 'bigint' }).notNull(),
  },
  (t) => [
    index('invoice_lines_company_id_invoice_id_idx').on(t.companyId, t.invoiceId),
    check('invoice_lines_discount_check', sql`${t.discountRate} >= 0 and ${t.discountRate} <= 100`),
  ],
);

export const invoicePayments = pgTable(
  'invoice_payments',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id),
    amountCents: bigint('amount_cents', { mode: 'bigint' }).notNull(),
    method: text('method').notNull(),
    date: date('date').notNull(),
    reference: text('reference'),
  },
  (t) => [
    index('invoice_payments_company_id_invoice_id_idx').on(t.companyId, t.invoiceId),
    check('invoice_payments_amount_check', sql`${t.amountCents} > 0`),
    check(
      'invoice_payments_method_check',
      sql`${t.method} in ('cash','ccp','transfer','cib','edahabia','cheque')`,
    ),
  ],
);

export { INVOICE_TYPES, PAYMENT_METHODS };
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceLine = typeof invoiceLines.$inferSelect;
export type InvoicePayment = typeof invoicePayments.$inferSelect;
