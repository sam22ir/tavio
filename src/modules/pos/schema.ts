import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { companies } from '@/core/db/schema/tenancy';
import { partners } from '@/modules/contacts/schema';
import { products } from '@/modules/products/schema';

// Common columns (DATA_MODEL.md 0.1). `created_by` references users.id (FK added by integrator).
const commonColumns = () => ({
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // FK → users.id (added by integrator)
  createdBy: uuid('created_by'),
});

// POS sessions (cash register shifts). Tenant table.
export const posSessions = pgTable(
  'pos_sessions',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // FK → users.id (added by integrator)
    openedBy: uuid('opened_by').notNull(),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    openingCashCents: bigint('opening_cash_cents', { mode: 'bigint' }).notNull().default(sql`0`),
    closingCashCents: bigint('closing_cash_cents', { mode: 'bigint' }),
    state: text('state').notNull().default('open'),
  },
  (t) => [
    index('pos_sessions_company_id_state_idx').on(t.companyId, t.state),
    index('pos_sessions_company_id_opened_at_idx').on(t.companyId, t.openedAt),
    check('pos_sessions_state_check', sql`${t.state} in ('open', 'closed')`),
    check('pos_sessions_opening_cash_check', sql`${t.openingCashCents} >= 0`),
    check(
      'pos_sessions_closing_cash_check',
      sql`${t.closingCashCents} is null or ${t.closingCashCents} >= 0`,
    ),
  ],
);

// POS orders (paid at the counter). Tenant table. Posted, so never edited: refunds are new documents (not in P7).
export const posOrders = pgTable(
  'pos_orders',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => posSessions.id),
    // POS-{YYYY}-00001, from core/sequences
    number: text('number').notNull(),
    // Optional customer
    partnerId: uuid('partner_id').references(() => partners.id),
    method: text('method').notNull(),
    untaxedCents: bigint('untaxed_cents', { mode: 'bigint' }).notNull(),
    taxCents: bigint('tax_cents', { mode: 'bigint' }).notNull(),
    totalCents: bigint('total_cents', { mode: 'bigint' }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('pos_orders_company_id_session_id_idx').on(t.companyId, t.sessionId),
    index('pos_orders_company_id_paid_at_idx').on(t.companyId, t.paidAt),
    uniqueIndex('pos_orders_company_id_number_key').on(t.companyId, t.number),
    check('pos_orders_method_check', sql`${t.method} in ('cash', 'cib', 'edahabia')`),
    check(
      'pos_orders_totals_check',
      sql`${t.untaxedCents} >= 0 and ${t.taxCents} >= 0 and ${t.totalCents} = ${t.untaxedCents} + ${t.taxCents}`,
    ),
  ],
);

// POS order lines. Tenant table. Prices and tax rates are copied from the product at sale time.
export const posOrderLines = pgTable(
  'pos_order_lines',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    orderId: uuid('order_id')
      .notNull()
      .references(() => posOrders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    description: text('description').notNull(),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
    unitPriceCents: bigint('unit_price_cents', { mode: 'bigint' }).notNull(),
    // percent, 19.0000 for 19%
    taxRate: numeric('tax_rate', { precision: 7, scale: 4 }).notNull(),
    subtotalCents: bigint('subtotal_cents', { mode: 'bigint' }).notNull(),
    taxCents: bigint('tax_cents', { mode: 'bigint' }).notNull(),
  },
  (t) => [
    index('pos_order_lines_company_id_order_id_idx').on(t.companyId, t.orderId),
    check('pos_order_lines_quantity_check', sql`${t.quantity} > 0`),
    check('pos_order_lines_amounts_check', sql`${t.unitPriceCents} >= 0 and ${t.subtotalCents} >= 0 and ${t.taxCents} >= 0`),
  ],
);

export type PosSession = typeof posSessions.$inferSelect;
export type NewPosSession = typeof posSessions.$inferInsert;
export type PosOrder = typeof posOrders.$inferSelect;
export type NewPosOrder = typeof posOrders.$inferInsert;
export type PosOrderLine = typeof posOrderLines.$inferSelect;
export type NewPosOrderLine = typeof posOrderLines.$inferInsert;
