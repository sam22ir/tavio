import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  boolean,
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

// Common columns (DATA_MODEL.md 0.1). `created_by` references users.id (FK added by integrator).
const commonColumns = () => ({
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
});

// Product categories (DATA_MODEL.md 3.3). Tenant table.
export const productCategories = pgTable(
  'product_categories',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // null for root categories
    parentId: uuid('parent_id').references((): AnyPgColumn => productCategories.id),
    name: text('name').notNull(),
    // short code for labels
    code: text('code'),
  },
  (t) => [
    index('product_categories_company_id_parent_id_idx').on(t.companyId, t.parentId),
    uniqueIndex('product_categories_company_id_name_key').on(t.companyId, t.name),
    uniqueIndex('product_categories_company_id_code_key')
      .on(t.companyId, t.code)
      .where(sql`${t.code} is not null`),
  ],
);

// Products (DATA_MODEL.md 3.4). Tenant table. Stock on hand lives in `quants` (P5).
export const products = pgTable(
  'products',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // internal reference
    sku: text('sku'),
    // French or default name
    name: text('name').notNull(),
    nameAr: text('name_ar'),
    categoryId: uuid('category_id').references(() => productCategories.id),
    // goods or service
    kind: text('kind').notNull(),
    uomId: uuid('uom_id')
      .notNull()
      .references(() => uoms.id),
    // centimes, tax excluded
    salePriceCents: bigint('sale_price_cents', { mode: 'bigint' }).notNull(),
    costCents: bigint('cost_cents', { mode: 'bigint' }).notNull(),
    // Weighted average unit cost (CMUP), centimes. One value per product per company: products are
    // company-scoped and the average runs across all warehouses. Null until the first receipt;
    // readers fall back to costCents.
    avgCostCents: bigint('avg_cost_cents', { mode: 'bigint' }),
    // FK → taxes.id (added by integrator)
    defaultTaxId: uuid('default_tax_id'),
    trackStock: boolean('track_stock').notNull().default(false),
    barcode: text('barcode'),
    description: text('description'),
    active: boolean('active').notNull().default(true),
  },
  (t) => [
    index('products_company_id_category_id_idx').on(t.companyId, t.categoryId),
    index('products_company_id_name_idx').on(t.companyId, t.name),
    index('products_company_id_active_idx').on(t.companyId, t.active),
    uniqueIndex('products_company_id_sku_key')
      .on(t.companyId, t.sku)
      .where(sql`${t.sku} is not null`),
    uniqueIndex('products_company_id_barcode_key')
      .on(t.companyId, t.barcode)
      .where(sql`${t.barcode} is not null`),
    check('products_kind_check', sql`${t.kind} in ('goods', 'service')`),
    check('products_sale_price_cents_check', sql`${t.salePriceCents} >= 0`),
    check('products_cost_cents_check', sql`${t.costCents} >= 0`),
  ],
);

// Units of measure (DATA_MODEL.md 3.5). Global reference: no company_id, no created_by.
export const uoms = pgTable(
  'uoms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    // piece, kg, g, m, m2, l, box, and so on
    code: text('code').notNull(),
    nameFr: text('name_fr').notNull(),
    nameAr: text('name_ar'),
    nameEn: text('name_en'),
    // unit, weight, length, area, volume, time
    category: text('category').notNull(),
    // conversion to the category reference unit (reference = 1)
    factorToRef: numeric('factor_to_ref', { precision: 20, scale: 10 }).notNull(),
    isReference: boolean('is_reference').notNull(),
    active: boolean('active').notNull().default(true),
  },
  (t) => [
    index('uoms_category_idx').on(t.category),
    uniqueIndex('uoms_code_key').on(t.code),
    uniqueIndex('uoms_category_reference_key')
      .on(t.category)
      .where(sql`${t.isReference}`),
    check(
      'uoms_category_check',
      sql`${t.category} in ('unit', 'weight', 'length', 'area', 'volume', 'time')`,
    ),
  ],
);

export type ProductCategory = typeof productCategories.$inferSelect;
export type NewProductCategory = typeof productCategories.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Uom = typeof uoms.$inferSelect;
export type NewUom = typeof uoms.$inferInsert;

type UomSeed = Pick<NewUom, 'code' | 'nameFr' | 'nameAr' | 'nameEn' | 'category' | 'factorToRef' | 'isReference'>;

/** Default units of measure, used by the integrator's seed SQL. */
export const UOM_SEED: readonly UomSeed[] = [
  { code: 'unit', nameFr: 'Unité', nameAr: 'وحدة', nameEn: 'Unit', category: 'unit', factorToRef: '1', isReference: true },
  { code: 'dozen', nameFr: 'Douzaine', nameAr: 'دستة', nameEn: 'Dozen', category: 'unit', factorToRef: '12', isReference: false },
  { code: 'box', nameFr: 'Boîte', nameAr: 'علبة', nameEn: 'Box', category: 'unit', factorToRef: '1', isReference: false },
  { code: 'pack', nameFr: 'Paquet', nameAr: 'حزمة', nameEn: 'Pack', category: 'unit', factorToRef: '1', isReference: false },
  { code: 'kg', nameFr: 'Kilogramme', nameAr: 'كيلوغرام', nameEn: 'Kilogram', category: 'weight', factorToRef: '1', isReference: true },
  { code: 'g', nameFr: 'Gramme', nameAr: 'غرام', nameEn: 'Gram', category: 'weight', factorToRef: '0.001', isReference: false },
  { code: 't', nameFr: 'Tonne', nameAr: 'طن', nameEn: 'Tonne', category: 'weight', factorToRef: '1000', isReference: false },
  { code: 'm', nameFr: 'Mètre', nameAr: 'متر', nameEn: 'Meter', category: 'length', factorToRef: '1', isReference: true },
  { code: 'cm', nameFr: 'Centimètre', nameAr: 'سنتيمتر', nameEn: 'Centimeter', category: 'length', factorToRef: '0.01', isReference: false },
  { code: 'mm', nameFr: 'Millimètre', nameAr: 'ملليمتر', nameEn: 'Millimeter', category: 'length', factorToRef: '0.001', isReference: false },
  { code: 'km', nameFr: 'Kilomètre', nameAr: 'كيلومتر', nameEn: 'Kilometer', category: 'length', factorToRef: '1000', isReference: false },
  { code: 'm2', nameFr: 'Mètre carré', nameAr: 'متر مربع', nameEn: 'Square meter', category: 'area', factorToRef: '1', isReference: true },
  { code: 'l', nameFr: 'Litre', nameAr: 'لتر', nameEn: 'Liter', category: 'volume', factorToRef: '1', isReference: true },
  { code: 'ml', nameFr: 'Millilitre', nameAr: 'ميليلتر', nameEn: 'Milliliter', category: 'volume', factorToRef: '0.001', isReference: false },
  { code: 'm3', nameFr: 'Mètre cube', nameAr: 'متر مكعب', nameEn: 'Cubic meter', category: 'volume', factorToRef: '1000', isReference: false },
  { code: 's', nameFr: 'Seconde', nameAr: 'ثانية', nameEn: 'Second', category: 'time', factorToRef: '1', isReference: true },
  { code: 'min', nameFr: 'Minute', nameAr: 'دقيقة', nameEn: 'Minute', category: 'time', factorToRef: '60', isReference: false },
  { code: 'h', nameFr: 'Heure', nameAr: 'ساعة', nameEn: 'Hour', category: 'time', factorToRef: '3600', isReference: false },
  { code: 'day', nameFr: 'Jour', nameAr: 'يوم', nameEn: 'Day', category: 'time', factorToRef: '86400', isReference: false },
];
