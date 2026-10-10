import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { companies } from '@/core/db/schema/tenancy';
import { taxes } from '@/modules/l10n_dz/schema';
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

export const PURCHASE_ORDER_STATES = ['draft', 'sent', 'confirmed', 'received', 'cancelled'] as const;

// Purchase orders (P5 purchase, W5-D). Tenant table. Posted (confirmed and later) orders are immutable.
export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // PO-{YYYY}-NNNNN, assigned on confirm (gap-free via nextNumber)
    number: text('number'),
    partnerId: uuid('partner_id')
      .notNull()
      .references(() => partners.id),
    state: text('state').notNull().default('draft'),
    orderDate: date('order_date').notNull(),
    expectedDate: date('expected_date'),
    untaxedCents: bigint('untaxed_cents', { mode: 'bigint' }).notNull().default(sql`0`),
    taxCents: bigint('tax_cents', { mode: 'bigint' }).notNull().default(sql`0`),
    totalCents: bigint('total_cents', { mode: 'bigint' }).notNull().default(sql`0`),
    // True only when every line is fully billed (billed_qty >= quantity). Derived by createBillFromOrder.
    billed: boolean('billed').notNull().default(false),
    note: text('note'),
    // Document that created the order, e.g. credit_sales.contract (null for manual orders)
    sourceEntity: text('source_entity'),
    sourceId: uuid('source_id'),
  },
  (t) => [
    index('purchase_orders_company_id_state_idx').on(t.companyId, t.state),
    // One order per supplier per source document: a redelivered event cannot create a second order.
    uniqueIndex('purchase_orders_company_id_source_partner_uq')
      .on(t.companyId, t.sourceEntity, t.sourceId, t.partnerId)
      .where(sql`${t.sourceId} is not null`),
    index('purchase_orders_company_id_partner_id_idx').on(t.companyId, t.partnerId),
    uniqueIndex('purchase_orders_company_id_number_uq').on(t.companyId, t.number),
    check(
      'purchase_orders_state_check',
      sql`${t.state} in ('draft', 'sent', 'confirmed', 'received', 'cancelled')`,
    ),
    check(
      'purchase_orders_totals_check',
      sql`${t.untaxedCents} >= 0 and ${t.taxCents} >= 0 and ${t.totalCents} >= 0`,
    ),
  ],
);

// Purchase order lines. Tenant table.
export const purchaseOrderLines = pgTable(
  'purchase_order_lines',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    orderId: uuid('order_id')
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull().default(10),
    productId: uuid('product_id').references(() => products.id),
    description: text('description').notNull(),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
    receivedQty: numeric('received_qty', { precision: 14, scale: 3 }).notNull().default('0'),
    // Quantity already put on vendor bills, same unit as receivedQty. Bills are for received - billed.
    billedQty: numeric('billed_qty', { precision: 14, scale: 3 }).notNull().default('0'),
    unitPriceCents: bigint('unit_price_cents', { mode: 'bigint' }).notNull(),
    taxId: uuid('tax_id').references(() => taxes.id),
    subtotalCents: bigint('subtotal_cents', { mode: 'bigint' }).notNull().default(sql`0`),
    taxCents: bigint('tax_cents', { mode: 'bigint' }).notNull().default(sql`0`),
  },
  (t) => [
    index('purchase_order_lines_company_id_order_id_idx').on(t.companyId, t.orderId),
    check('purchase_order_lines_quantity_check', sql`${t.quantity} > 0`),
    check(
      'purchase_order_lines_billed_check',
      sql`${t.billedQty} >= 0 and ${t.billedQty} <= ${t.receivedQty}`,
    ),
    check(
      'purchase_order_lines_received_check',
      sql`${t.receivedQty} >= 0 and ${t.receivedQty} <= ${t.quantity}`,
    ),
    check('purchase_order_lines_unit_price_check', sql`${t.unitPriceCents} >= 0`),
  ],
);

// Preferred suppliers per product, used to split a source document (e.g. an approved contract) into orders. Tenant table.
export const purchaseProductSuppliers = pgTable(
  'purchase_product_suppliers',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    partnerId: uuid('partner_id')
      .notNull()
      .references(() => partners.id),
    // Lowest sequence wins when a product has several suppliers
    sequence: integer('sequence').notNull().default(10),
    active: boolean('active').notNull().default(true),
  },
  (t) => [
    index('purchase_product_suppliers_company_id_product_id_idx').on(t.companyId, t.productId),
    uniqueIndex('purchase_product_suppliers_company_product_partner_uq').on(t.companyId, t.productId, t.partnerId),
  ],
);

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderLine = typeof purchaseOrderLines.$inferSelect;
export type PurchaseProductSupplier = typeof purchaseProductSuppliers.$inferSelect;
