import { sql } from 'drizzle-orm';
import {
  check,
  index,
  numeric,
  pgTable,
  text,
  boolean,
  date,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { companies } from '@/core/db/schema/tenancy';
import { products } from '@/modules/products/schema';

// Common columns (DATA_MODEL.md 0.1). `created_by` references users.id (FK added by integrator).
const commonColumns = () => ({
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // FK → users.id (added by integrator)
  createdBy: uuid('created_by'),
});

// Warehouses. Tenant table.
export const warehouses = pgTable(
  'warehouses',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    code: text('code').notNull(),
    name: text('name').notNull(),
    // '01' to '58', from wilayas seed (l10n_dz)
    wilayaCode: text('wilaya_code'),
    active: boolean('active').notNull().default(true),
  },
  (t) => [
    uniqueIndex('warehouses_company_id_code_key').on(t.companyId, t.code),
    index('warehouses_company_id_active_idx').on(t.companyId, t.active),
  ],
);

// Stock locations. Internal locations belong to a warehouse; customer, supplier and
// inventory_loss locations are company-wide (warehouse_id null). Tenant table.
export const stockLocations = pgTable(
  'stock_locations',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // FK → warehouses.id, null for company-wide locations
    warehouseId: uuid('warehouse_id').references(() => warehouses.id),
    type: text('type').notNull(),
    name: text('name').notNull(),
  },
  (t) => [
    index('stock_locations_company_id_type_idx').on(t.companyId, t.type),
    uniqueIndex('stock_locations_company_id_warehouse_id_type_key')
      .on(t.companyId, t.warehouseId, t.type)
      .where(sql`${t.warehouseId} is not null`),
    uniqueIndex('stock_locations_company_id_type_global_key')
      .on(t.companyId, t.type)
      .where(sql`${t.warehouseId} is null`),
    check(
      'stock_locations_type_check',
      sql`${t.type} in ('internal', 'customer', 'supplier', 'inventory_loss')`,
    ),
    check(
      'stock_locations_internal_warehouse_check',
      sql`${t.type} <> 'internal' or ${t.warehouseId} is not null`,
    ),
  ],
);

// Stock moves (DATA_MODEL.md P5). Tenant table. Done moves are immutable.
export const stockMoves = pgTable(
  'stock_moves',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    reference: text('reference').notNull(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    // Up to 11 integer digits and 3 decimals
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
    fromLocationId: uuid('from_location_id')
      .notNull()
      .references(() => stockLocations.id),
    toLocationId: uuid('to_location_id')
      .notNull()
      .references(() => stockLocations.id),
    state: text('state').notNull().default('draft'),
    // Polymorphic origin, e.g. 'sales.order'. source_id is not a foreign key.
    // FK → sales_orders.id (integrator) when source_entity is 'sales.order'
    sourceEntity: text('source_entity'),
    sourceId: uuid('source_id'),
    doneAt: timestamp('done_at', { withTimezone: true }),
  },
  (t) => [
    index('stock_moves_company_id_state_idx').on(t.companyId, t.state),
    index('stock_moves_company_id_product_id_idx').on(t.companyId, t.productId),
    index('stock_moves_company_id_from_location_id_idx').on(t.companyId, t.fromLocationId),
    index('stock_moves_company_id_to_location_id_idx').on(t.companyId, t.toLocationId),
    // Idempotency for event handlers: one live move per source line.
    uniqueIndex('stock_moves_company_id_source_product_key')
      .on(t.companyId, t.sourceEntity, t.sourceId, t.productId)
      .where(sql`${t.sourceId} is not null and ${t.state} <> 'cancelled'`),
    check('stock_moves_state_check', sql`${t.state} in ('draft', 'done', 'cancelled')`),
    check('stock_moves_quantity_check', sql`${t.quantity} > 0`),
    check('stock_moves_done_at_check', sql`${t.state} <> 'done' or ${t.doneAt} is not null`),
    check('stock_moves_locations_check', sql`${t.fromLocationId} <> ${t.toLocationId}`),
  ],
);

// Reorder rules: minimum stock per product and warehouse. Tenant table.
export const reorderRules = pgTable(
  'reorder_rules',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id),
    minQty: numeric('min_qty', { precision: 14, scale: 3 }).notNull(),
    maxQty: numeric('max_qty', { precision: 14, scale: 3 }),
  },
  (t) => [
    uniqueIndex('reorder_rules_company_id_product_id_warehouse_id_key').on(
      t.companyId,
      t.productId,
      t.warehouseId,
    ),
    check('reorder_rules_min_check', sql`${t.minQty} >= 0`),
    check('reorder_rules_max_check', sql`${t.maxQty} is null or ${t.maxQty} >= ${t.minQty}`),
  ],
);

// Stock reservations: quantity held for a source document (e.g. an approved credit contract).
// Active reservations reduce the available quantity. Tenant table.
export const stockReservations = pgTable(
  'stock_reservations',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    locationId: uuid('location_id')
      .notNull()
      .references(() => stockLocations.id),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
    sourceEntity: text('source_entity').notNull(),
    sourceId: uuid('source_id').notNull(),
    state: text('state').notNull().default('active'),
  },
  (t) => [
    index('stock_reservations_company_id_state_product_idx').on(t.companyId, t.state, t.productId),
    index('stock_reservations_company_id_source_idx').on(t.companyId, t.sourceEntity, t.sourceId),
    // Idempotency for event handlers: one active reservation per source line.
    uniqueIndex('stock_reservations_company_id_source_product_active_key')
      .on(t.companyId, t.sourceEntity, t.sourceId, t.productId)
      .where(sql`${t.state} = 'active'`),
    check('stock_reservations_state_check', sql`${t.state} in ('active', 'released', 'consumed')`),
    check('stock_reservations_quantity_check', sql`${t.quantity} > 0`),
  ],
);

// Deliveries (customer dispatch orders). Tenant table. Validating a delivery creates stock moves out.
export const deliveries = pgTable(
  'deliveries',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    number: text('number').notNull(),
    // FK → partners.id (added by integrator)
    partnerId: uuid('partner_id').notNull(),
    sourceEntity: text('source_entity'),
    sourceId: uuid('source_id'),
    state: text('state').notNull().default('draft'),
    scheduledDate: date('scheduled_date'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    signedByName: text('signed_by_name'),
    // FK → files.id (added by integrator)
    signatureFileId: uuid('signature_file_id'),
    // FK → files.id (added by integrator)
    proofFileId: uuid('proof_file_id'),
    note: text('note'),
  },
  (t) => [
    uniqueIndex('deliveries_company_id_number_key').on(t.companyId, t.number),
    index('deliveries_company_id_state_idx').on(t.companyId, t.state),
    index('deliveries_company_id_source_idx').on(t.companyId, t.sourceEntity, t.sourceId),
    // Idempotency for event handlers: one live delivery per source document.
    uniqueIndex('deliveries_company_id_source_live_key')
      .on(t.companyId, t.sourceEntity, t.sourceId)
      .where(sql`${t.sourceId} is not null and ${t.state} <> 'cancelled'`),
    check('deliveries_state_check', sql`${t.state} in ('draft', 'ready', 'done', 'cancelled')`),
    check('deliveries_done_at_check', sql`${t.state} <> 'done' or ${t.deliveredAt} is not null`),
  ],
);

export const deliveryLines = pgTable(
  'delivery_lines',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    deliveryId: uuid('delivery_id')
      .notNull()
      .references(() => deliveries.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
  },
  (t) => [
    index('delivery_lines_company_id_delivery_id_idx').on(t.companyId, t.deliveryId),
    check('delivery_lines_quantity_check', sql`${t.quantity} > 0`),
  ],
);

export type Warehouse = typeof warehouses.$inferSelect;
export type NewWarehouse = typeof warehouses.$inferInsert;
export type StockLocation = typeof stockLocations.$inferSelect;
export type NewStockLocation = typeof stockLocations.$inferInsert;
export type StockMove = typeof stockMoves.$inferSelect;
export type NewStockMove = typeof stockMoves.$inferInsert;
export type ReorderRule = typeof reorderRules.$inferSelect;
export type NewReorderRule = typeof reorderRules.$inferInsert;
export type StockReservation = typeof stockReservations.$inferSelect;
export type NewStockReservation = typeof stockReservations.$inferInsert;
export type Delivery = typeof deliveries.$inferSelect;
export type NewDelivery = typeof deliveries.$inferInsert;
export type DeliveryLine = typeof deliveryLines.$inferSelect;
export type NewDeliveryLine = typeof deliveryLines.$inferInsert;
