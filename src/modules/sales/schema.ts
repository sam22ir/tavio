import { sql } from 'drizzle-orm';
import { bigint, boolean, check, index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { companies } from '@/core/db/schema/tenancy';
import { partners } from '@/modules/contacts/schema';
import { products } from '@/modules/products/schema';
import { taxes } from '@/modules/l10n_dz/schema';

// Common columns (DATA_MODEL.md 0.1). `created_by` references users.id (FK added by integrator).
const commonColumns = () => ({
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // FK → users.id (added by integrator)
  createdBy: uuid('created_by'),
});

// Sale orders and quotations (W5-A). Tenant table.
export const saleOrders = pgTable(
  'sale_orders',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // SO-{YYYY}-NNNNN, assigned on confirm. Null while draft.
    number: text('number'),
    partnerId: uuid('partner_id')
      .notNull()
      .references(() => partners.id),
    state: text('state').notNull().default('draft'),
    orderDate: text('order_date').notNull(),
    validityDate: text('validity_date'),
    // FK → users.id (added by integrator)
    salespersonId: uuid('salesperson_id'),
    note: text('note'),
    untaxedCents: bigint('untaxed_cents', { mode: 'bigint' }).notNull().default(sql`0`),
    taxCents: bigint('tax_cents', { mode: 'bigint' }).notNull().default(sql`0`),
    totalCents: bigint('total_cents', { mode: 'bigint' }).notNull().default(sql`0`),
    // True once an invoice has been created from this order (W5-B createInvoice)
    invoiced: boolean('invoiced').notNull().default(false),
  },
  (t) => [
    index('sale_orders_company_id_state_idx').on(t.companyId, t.state),
    index('sale_orders_company_id_partner_id_idx').on(t.companyId, t.partnerId),
    index('sale_orders_company_id_order_date_idx').on(t.companyId, t.orderDate),
    index('sale_orders_company_id_number_idx').on(t.companyId, t.number),
    check('sale_orders_state_check', sql`${t.state} in ('draft', 'sent', 'confirmed', 'cancelled', 'done')`),
    check(
      'sale_orders_totals_check',
      sql`${t.untaxedCents} >= 0 and ${t.taxCents} >= 0 and ${t.totalCents} >= 0`,
    ),
  ],
);

// Sale order lines (W5-A). Tenant table.
export const saleOrderLines = pgTable(
  'sale_order_lines',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    orderId: uuid('order_id')
      .notNull()
      .references(() => saleOrders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id),
    description: text('description').notNull(),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
    unitPriceCents: bigint('unit_price_cents', { mode: 'bigint' }).notNull(),
    // Percent, 0 to 100, e.g. 10.0000 for 10%
    discountRate: numeric('discount_rate', { precision: 7, scale: 4 }).notNull().default('0'),
    taxId: uuid('tax_id').references(() => taxes.id),
    subtotalCents: bigint('subtotal_cents', { mode: 'bigint' }).notNull(),
    taxCents: bigint('tax_cents', { mode: 'bigint' }).notNull(),
  },
  (t) => [
    index('sale_order_lines_company_id_order_id_idx').on(t.companyId, t.orderId),
    check('sale_order_lines_quantity_check', sql`${t.quantity} > 0`),
    check('sale_order_lines_unit_price_check', sql`${t.unitPriceCents} >= 0`),
    check(
      'sale_order_lines_discount_check',
      sql`${t.discountRate} >= 0 and ${t.discountRate} <= 100`,
    ),
  ],
);

export type SaleOrder = typeof saleOrders.$inferSelect;
export type NewSaleOrder = typeof saleOrders.$inferInsert;
export type SaleOrderLine = typeof saleOrderLines.$inferSelect;
export type NewSaleOrderLine = typeof saleOrderLines.$inferInsert;
