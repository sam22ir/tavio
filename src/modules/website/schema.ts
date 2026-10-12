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

const commonColumns = () => ({
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // FK → users.id (added by integrator). Null for anonymous storefront orders.
  createdBy: uuid('created_by'),
});

// Storefront settings, one row per company. Tenant table.
export const websiteSettings = pgTable(
  'website_settings',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // Public URL segment: /{locale}/shop/{slug}. Globally unique so the public lookup needs no tenant.
    slug: text('slug').notNull(),
    enabled: boolean('enabled').notNull().default(false),
    title: text('title').notNull(),
    about: text('about'),
    // E.164
    phoneWhatsapp: text('phone_whatsapp'),
    showPrices: boolean('show_prices').notNull().default(true),
    // When on, each new web order is converted to a draft sale order at checkout.
    autoCreateSaleOrder: boolean('auto_create_sale_order').notNull().default(false),
  },
  (t) => [
    uniqueIndex('website_settings_company_id_key').on(t.companyId),
    uniqueIndex('website_settings_slug_key').on(t.slug),
    index('website_settings_company_id_enabled_idx').on(t.companyId, t.enabled),
  ],
);

// Cash-on-delivery orders placed on the storefront. Tenant table.
export const webOrders = pgTable(
  'web_orders',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // WEB-{YYYY}-00001, from core/sequences
    number: text('number').notNull(),
    customerName: text('customer_name').notNull(),
    // E.164
    phone: text('phone').notNull(),
    // '01' to '69', from wilayas seed (l10n_dz)
    wilayaCode: text('wilaya_code').notNull(),
    address: text('address').notNull(),
    // [{ productId, name, unitPriceCents: string, quantity: number, subtotalCents: string }]
    lines: jsonb('lines').notNull().default([]),
    totalCents: bigint('total_cents', { mode: 'bigint' }).notNull(),
    state: text('state').notNull().default('new'),
    // FK → sale_orders.id (integrator). Set when converted to a sale order.
    saleOrderId: uuid('sale_order_id'),
  },
  (t) => [
    uniqueIndex('web_orders_company_id_number_key').on(t.companyId, t.number),
    index('web_orders_company_id_state_created_idx').on(t.companyId, t.state, t.createdAt),
    // Serves the per-phone rate limit on checkout
    index('web_orders_company_id_phone_created_idx').on(t.companyId, t.phone, t.createdAt),
    check('web_orders_state_check', sql`${t.state} in ('new', 'confirmed', 'cancelled')`),
    check('web_orders_total_check', sql`${t.totalCents} >= 0`),
  ],
);

export type WebsiteSettings = typeof websiteSettings.$inferSelect;
export type WebOrder = typeof webOrders.$inferSelect;
export type NewWebOrder = typeof webOrders.$inferInsert;
