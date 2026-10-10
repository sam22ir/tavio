import type { ZodType } from 'zod';
import { z } from 'zod';
import type { Ctx } from '@/core/ctx';
import type { EntityDef, FieldDef } from '@/core/entities/types';
import {
  normalizeHeader, parseBooleanText, validateRow, type ImportField, type IoLocale, type RowIssue,
} from '@/core/io';
import { parseDzd } from '@/core/money';
import { err, ok, type Result } from '@/core/result';
import { translateKey } from '@/ui/views/format';
import { leadEntity } from '@/modules/crm/entities';
import { createLead, leadInput } from '@/modules/crm/service/leads';
import { partnerEntity } from '@/modules/contacts/entities';
import {
  createPartner, findPartnerForImport, normalizePartner, normalizePhone, partnerDedupeKeys, partnerInput,
} from '@/modules/contacts/service/partners';
import { productEntity } from '@/modules/products/entities';
import { createProduct, findProductBySku, productInput, productSkuKeys } from '@/modules/products/service/products';
import { uomOptions } from '@/modules/products/service/uoms';
import { createAdjustment } from '@/modules/inventory/service/adjustments';
import { ensureDefaultWarehouse, listWarehouses, listLocations } from '@/modules/inventory/service/warehouses';
import { parentCodeOf, upsertAccount, type AccountType } from '@/modules/accounting/service/chart';
import { createOpeningEntry, type OpeningLine } from '@/modules/accounting/service/opening';
import { createSaleOrder, type SaleLineInput } from '@/modules/sales/service/orders';

export const IMPORT_ENTITY_NAMES = [
  'contacts.partner',
  'products.product',
  'crm.lead',
  'inventory.opening_stock',
  'accounting.chart_account',
  'accounting.opening_balance',
  'sales.quote',
] as const;
export type ImportEntityName = (typeof IMPORT_ENTITY_NAMES)[number];

export type ParsedRow =
  | { ok: true; keys: string[]; value: unknown; create: (ctx: Ctx) => Promise<Result<{ id: string }>> }
  | { ok: false; issues: RowIssue[] };

/** Result of a whole-file commit: created documents and per-line errors (codes or messages). */
export interface WholeFileOutcome {
  created: number;
  errors: { line: number; message: string }[];
}

export interface ImportTarget {
  name: ImportEntityName;
  entity: EntityDef;
  writePerm: string;
  fieldKeys: readonly string[];      // column order in the mapping and preview
  requiredKeys: readonly string[];
  duplicateKeyLabel: string;         // i18n key describing the duplicate rule
  /** One French sample row for the CSV template, keyed by field. */
  example: Record<string, string>;
  existingKeys?: (ctx: Ctx) => Promise<Set<string>>;
  parse: (raw: Record<string, string>, locale?: IoLocale) => ParsedRow;
  /**
   * Whole-file targets write all rows together (one balanced entry, grouped documents).
   * They are sent in one request, and `commit` receives every valid row with its file line.
   */
  wholeFile?: {
    commit: (ctx: Ctx, items: { line: number; value: unknown }[], env: { today: string }) => Promise<Result<WholeFileOutcome>>;
  };
}

const fieldDef = (entity: EntityDef, key: string): EntityDef['fields'][number] | undefined =>
  entity.fields.find((f) => f.name === key);

/** Raw text to input shape: blanks are absent, booleans become 'true'/'false', select labels in any locale map to their value. */
function prepareRaw(entity: EntityDef, keys: readonly string[], raw: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = (raw[key] ?? '').trim();
    const field = fieldDef(entity, key);
    if (field?.type === 'boolean') {
      out[key] = value === '' ? undefined : parseBooleanText(value);
      continue;
    }
    if (value === '') {
      out[key] = undefined;
      continue;
    }
    if (field?.type === 'select' && field.options) {
      const wanted = normalizeHeader(value);
      const match = field.options.find((o) =>
        [o.value, translateKey(o.label, 'fr'), translateKey(o.label, 'ar'), translateKey(o.label, 'en')]
          .some((candidate) => normalizeHeader(candidate) === wanted),
      );
      out[key] = match ? match.value : value;
      continue;
    }
    out[key] = value;
  }
  return out;
}

function defineTarget<T>(cfg: {
  name: ImportEntityName;
  entity: EntityDef;
  writePerm: string;
  fieldKeys: readonly string[];
  requiredKeys: readonly string[];
  duplicateKeyLabel: string;
  example: Record<string, string>;
  schema: ZodType<T>;
  prepare?: (raw: Record<string, string>, base: Record<string, unknown>) => Record<string, unknown>;
  /** Business rules that the service applies before writing, run here so the preview reports them. */
  check?: (value: T) => Result<unknown>;
  keysOf: (value: T) => string[];
  create?: (ctx: Ctx, value: T) => Promise<Result<{ id: string }>>;
  existingKeys?: (ctx: Ctx) => Promise<Set<string>>;
  wholeFile?: ImportTarget['wholeFile'];
}): ImportTarget {
  const create = cfg.create ?? (async () => err('INTERNAL', 'WHOLE_FILE_TARGET'));
  return {
    name: cfg.name,
    entity: cfg.entity,
    writePerm: cfg.writePerm,
    fieldKeys: cfg.fieldKeys,
    requiredKeys: cfg.requiredKeys,
    duplicateKeyLabel: cfg.duplicateKeyLabel,
    example: cfg.example,
    existingKeys: cfg.existingKeys,
    wholeFile: cfg.wholeFile,
    parse: (raw, locale = 'fr') => {
      const base = prepareRaw(cfg.entity, cfg.fieldKeys, raw);
      const prepared = cfg.prepare ? cfg.prepare(raw, base) : base;
      const checked = validateRow(cfg.schema, prepared, locale);
      if (!checked.ok) return checked;
      const value = checked.value;
      if (cfg.check) {
        const rule = cfg.check(value);
        if (!rule.ok) return { ok: false, issues: [{ field: rule.error.details?.field ? String(rule.error.details.field) : '', message: rule.error.message }] };
      }
      return { ok: true, keys: cfg.keysOf(value), value, create: (ctx) => create(ctx, value) };
    },
  };
}

// ---- Contacts, products and leads ----------------------------------------------------------------

const partnerTarget = defineTarget({
  name: 'contacts.partner',
  entity: partnerEntity,
  writePerm: 'contacts.partner.write',
  fieldKeys: [
    'kind', 'isCustomer', 'isSupplier', 'isProspect', 'firstName', 'lastName', 'companyName',
    'nif', 'nis', 'rc', 'ai', 'phone', 'phoneAlt', 'email', 'address', 'wilayaCode', 'commune',
    'employer', 'monthlyIncomeCents', 'notes',
  ],
  requiredKeys: ['kind'],
  duplicateKeyLabel: 'io.import.dup_key_partner',
  example: {
    kind: 'Personne morale', isCustomer: 'oui', isSupplier: 'non', isProspect: 'non', companyName: 'Entreprise Exemple SARL',
    nif: '000000000000000', phone: '0550123456', address: 'Alger', wilayaCode: '16',
  },
  schema: partnerInput,
  check: (v) => normalizePartner(v),
  keysOf: (v) => {
    const keys: string[] = [];
    const phone = v.phone ? normalizePhone(v.phone) : null;
    if (phone) keys.push(`phone:${phone}`);
    if (v.nif) keys.push(`nif:${v.nif}`);
    return keys;
  },
  create: (ctx, v) => createPartner(ctx, v),
  existingKeys: partnerDedupeKeys,
});

const productTarget = defineTarget({
  name: 'products.product',
  entity: productEntity,
  writePerm: 'products.product.write',
  fieldKeys: [
    'name', 'nameAr', 'sku', 'barcode', 'kind', 'salePriceCents', 'costCents', 'trackStock', 'active', 'description',
  ],
  requiredKeys: ['name', 'kind', 'salePriceCents', 'costCents'],
  duplicateKeyLabel: 'io.import.dup_key_product',
  example: {
    name: 'Ciment CPJ 42,5', sku: 'CIM-001', kind: 'Bien', salePriceCents: '1800,00', costCents: '1500,00', trackStock: 'oui', active: 'oui',
  },
  // Products without an explicit "active" value are active.
  prepare: (raw, base) => ({ ...base, active: (raw.active ?? '').trim() === '' ? 'true' : base.active }),
  schema: productInput.omit({ uomId: true, categoryId: true }),
  keysOf: (v) => (v.sku ? [`sku:${v.sku}`] : []),
  create: async (ctx, v) => {
    const uoms = await uomOptions(ctx);
    if (!uoms.ok) return uoms;
    const first = uoms.value[0];
    if (!first) return err('VALIDATION', 'No unit of measure is configured');
    return createProduct(ctx, { ...v, categoryId: null, uomId: first.value });
  },
  existingKeys: productSkuKeys,
});

const leadTarget = defineTarget({
  name: 'crm.lead',
  entity: leadEntity,
  writePerm: 'crm.lead.write',
  fieldKeys: ['type', 'name', 'contactName', 'phone', 'email', 'wilayaCode', 'source', 'channel', 'probability', 'expectedCloseDate'],
  requiredKeys: ['name'],
  duplicateKeyLabel: 'io.import.dup_key_lead',
  example: { type: 'Opportunité', name: 'Projet entrepôt Blida', contactName: 'Ali Benali', phone: '0661234567', wilayaCode: '09', probability: '40' },
  schema: leadInput,
  keysOf: () => [],
  create: (ctx, v) => createLead(ctx, v),
});

// ---- Helpers for the new targets -----------------------------------------------------------------

/** Plain entity metadata for the new targets. Labels are io.import.f.* keys, translated per locale. */
function importEntity(name: ImportEntityName, keys: readonly string[]): EntityDef {
  const fields: FieldDef[] = keys.map((key) => ({ name: key, type: 'text', label: `io.import.f.${key}` }));
  return { name, labelField: keys[0] ?? '', fields };
}

/** Amount text ("1500,50", "1500.50") to centimes. Negative and malformed amounts are invalid. */
const amountCents = z.string().trim().transform((v, c) => {
  const cents = parseDzd(v);
  if (cents === null || cents < BigInt(0)) {
    c.addIssue({ code: 'custom', message: 'MONEY', input: v });
    return z.NEVER;
  }
  return cents;
});

/** Dates as YYYY-MM-DD or DD/MM/YYYY (also with - or . separators). Returns ISO or null. */
export function toIsoDate(text: string): string | null {
  const t = text.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (!iso && !dmy) return null;
  const y = iso ? iso[1] : dmy?.[3];
  const m = iso ? iso[2] : (dmy?.[2] ?? '').padStart(2, '0');
  const d = iso ? iso[3] : (dmy?.[1] ?? '').padStart(2, '0');
  if (!y || !m || !d) return null;
  const date = new Date(`${y}-${m}-${d}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== `${y}-${m}-${d}`) return null;
  return `${y}-${m}-${d}`;
}

const isoDate = z.string().trim().transform((v, c) => {
  const iso = toIsoDate(v);
  if (!iso) {
    c.addIssue({ code: 'custom', message: 'DATE', input: v });
    return z.NEVER;
  }
  return iso;
});

const ACCOUNT_CODE = /^\d{2,8}$/;
const QUANTITY = /^\d{1,11}([.,]\d{1,3})?$/;
const PERCENT = /^\d{1,3}([.,]\d{1,4})?$/;

// ---- Opening stock quantities --------------------------------------------------------------------

const openingStockSchema = z.object({
  productCode: z.string().trim().min(1).max(64),
  warehouseCode: z.string().trim().max(32).optional(),
  quantity: z.string().trim().regex(QUANTITY, { message: 'QUANTITY' }).transform((v) => v.replace(',', '.')),
  unitCost: amountCents,
}).refine((v) => Number(v.quantity) > 0, { message: 'QUANTITY', path: ['quantity'] });
type OpeningStockValue = z.infer<typeof openingStockSchema>;

/** Posts one opening stock line through the inventory adjustment service (CMUP and Dr 30 / Cr 101 accounting). */
async function createOpeningStock(ctx: Ctx, v: OpeningStockValue): Promise<Result<{ id: string }>> {
  const product = await findProductBySku(ctx, v.productCode);
  if (!product) return err('NOT_FOUND', 'PRODUCT_NOT_FOUND');

  let locationId: string;
  if (!v.warehouseCode) {
    locationId = (await ensureDefaultWarehouse(ctx)).internalLocationId;
  } else {
    const warehouses = await listWarehouses(ctx);
    if (!warehouses.ok) return warehouses;
    const code = v.warehouseCode.toUpperCase();
    const warehouse = warehouses.value.find((w) => w.code.toUpperCase() === code);
    if (!warehouse) return err('NOT_FOUND', 'WAREHOUSE_NOT_FOUND');
    const locations = await listLocations(ctx);
    if (!locations.ok) return locations;
    const location = locations.value.find((l) => l.warehouseId === warehouse.id && l.type === 'internal');
    if (!location) return err('NOT_FOUND', 'WAREHOUSE_NOT_FOUND');
    locationId = location.id;
  }

  const posted = await createAdjustment(ctx, {
    productId: product.id,
    locationId,
    countedQty: v.quantity,
    unitCostCents: v.unitCost,
    opening: true,
  });
  if (!posted.ok) return posted;
  return ok({ id: posted.value.moveId ?? product.id });
}

const openingStockTarget = defineTarget({
  name: 'inventory.opening_stock',
  entity: importEntity('inventory.opening_stock', ['productCode', 'warehouseCode', 'quantity', 'unitCost']),
  writePerm: 'inventory.adjustment.write',
  fieldKeys: ['productCode', 'warehouseCode', 'quantity', 'unitCost'],
  requiredKeys: ['productCode', 'quantity', 'unitCost'],
  duplicateKeyLabel: 'io.import.dup_key_none',
  example: { productCode: 'CIM-001', warehouseCode: 'WH', quantity: '100', unitCost: '1500,00' },
  schema: openingStockSchema,
  keysOf: () => [],
  create: createOpeningStock,
});

// ---- Chart of accounts ---------------------------------------------------------------------------

const ACCOUNT_TYPE_WORDS: Record<string, AccountType> = {
  asset: 'asset', actif: 'asset',
  liability: 'liability', passif: 'liability',
  equity: 'equity', capitaux: 'equity', capitauxpropres: 'equity',
  income: 'income', produit: 'income', produits: 'income',
  expense: 'expense', charge: 'expense', charges: 'expense',
};

const chartAccountSchema = z.object({
  code: z.string().trim().regex(ACCOUNT_CODE, { message: 'ACCOUNT_CODE' }),
  label: z.string().trim().min(1).max(200),
  parent: z.string().trim().max(8).optional(),
  type: z.string().trim().transform((v, c) => {
    const type = ACCOUNT_TYPE_WORDS[normalizeHeader(v)];
    if (!type) {
      c.addIssue({ code: 'custom', message: 'ACCOUNT_TYPE', input: v });
      return z.NEVER;
    }
    return type;
  }),
}).superRefine((v, c) => {
  if (v.parent && v.parent !== parentCodeOf(v.code)) c.addIssue({ code: 'custom', message: 'PARENT_MISMATCH', path: ['parent'] });
});

const chartAccountTarget = defineTarget({
  name: 'accounting.chart_account',
  entity: importEntity('accounting.chart_account', ['code', 'label', 'parent', 'type']),
  writePerm: 'accounting.account.write',
  fieldKeys: ['code', 'label', 'parent', 'type'],
  requiredKeys: ['code', 'label', 'type'],
  duplicateKeyLabel: 'io.import.dup_key_none',
  example: { code: '5121', label: 'Banque', parent: '51', type: 'Actif' },
  schema: chartAccountSchema,
  keysOf: () => [],
  create: async (ctx, v) => {
    const upserted = await upsertAccount(ctx, { code: v.code, name: v.label, type: v.type });
    if (!upserted.ok) return upserted;
    return ok({ id: upserted.value.id });
  },
});

// ---- Opening balances ----------------------------------------------------------------------------

const openingBalanceSchema = z.object({
  accountCode: z.string().trim().regex(ACCOUNT_CODE, { message: 'ACCOUNT_CODE' }),
  partner: z.string().trim().max(200).optional(),
  debit: amountCents.optional(),
  credit: amountCents.optional(),
}).superRefine((v, c) => {
  const debit = v.debit ?? BigInt(0);
  const credit = v.credit ?? BigInt(0);
  if (debit > BigInt(0) && credit > BigInt(0)) c.addIssue({ code: 'custom', message: 'BOTH_SIDES', path: ['credit'] });
  if (debit === BigInt(0) && credit === BigInt(0)) c.addIssue({ code: 'custom', message: 'AMOUNT_REQUIRED', path: ['debit'] });
});
type OpeningBalanceValue = z.infer<typeof openingBalanceSchema>;

const openingBalanceTarget = defineTarget({
  name: 'accounting.opening_balance',
  entity: importEntity('accounting.opening_balance', ['accountCode', 'partner', 'debit', 'credit']),
  writePerm: 'accounting.entry.write',
  fieldKeys: ['accountCode', 'partner', 'debit', 'credit'],
  requiredKeys: ['accountCode'],
  duplicateKeyLabel: 'io.import.dup_key_none',
  example: { accountCode: '512', partner: '', debit: '150000,00', credit: '' },
  schema: openingBalanceSchema,
  keysOf: () => [],
  wholeFile: {
    commit: async (ctx, items, env) => {
      const lines: OpeningLine[] = [];
      const errors: { line: number; message: string }[] = [];
      for (const item of items) {
        const v = item.value as OpeningBalanceValue;
        let partnerId: string | null = null;
        if (v.partner) {
          const found = await findPartnerForImport(ctx, { name: v.partner, phone: v.partner, nif: v.partner });
          if (found === null || found === 'ambiguous') {
            errors.push({ line: item.line, message: found === 'ambiguous' ? 'PARTNER_AMBIGUOUS' : 'PARTNER_NOT_FOUND' });
            continue;
          }
          partnerId = found.id;
        }
        lines.push({
          accountCode: v.accountCode,
          partnerId,
          debitCents: v.debit ?? BigInt(0),
          creditCents: v.credit ?? BigInt(0),
        });
      }
      if (errors.length > 0) return ok({ created: 0, errors });
      // Refuses with OPENING_UNBALANCED (and the difference in details) when debits and credits differ.
      const written = await createOpeningEntry(ctx, { lines, today: env.today });
      if (!written.ok) return written;
      return ok({ created: 1, errors: [] });
    },
  },
});

// ---- Sales quotes --------------------------------------------------------------------------------

const quoteSchema = z.object({
  orderRef: z.string().trim().min(1).max(64),
  customer: z.string().trim().min(1).max(200),
  productCode: z.string().trim().min(1).max(64),
  quantity: z.string().trim().regex(QUANTITY, { message: 'QUANTITY' }).transform((v) => v.replace(',', '.')),
  unitPrice: z.string().trim().refine((v) => parseDzd(v) !== null, { message: 'MONEY' }),
  discount: z.string().trim().regex(PERCENT, { message: 'PERCENT' }).transform((v) => v.replace(',', '.')).optional(),
  date: isoDate,
});
type QuoteValue = z.infer<typeof quoteSchema>;

/** Groups quote lines by order ref and creates one draft quote per group. Lines of a group share customer and date. */
async function commitQuotes(ctx: Ctx, items: { line: number; value: unknown }[]): Promise<Result<WholeFileOutcome>> {
  const groups = new Map<string, { line: number; value: QuoteValue }[]>();
  for (const item of items) {
    const v = item.value as QuoteValue;
    const group = groups.get(v.orderRef) ?? [];
    group.push({ line: item.line, value: v });
    groups.set(v.orderRef, group);
  }

  let created = 0;
  const errors: { line: number; message: string }[] = [];
  for (const rows of groups.values()) {
    const head = rows[0];
    if (!head) continue;
    if (rows.some((r) => r.value.customer !== head.value.customer || r.value.date !== head.value.date)) {
      errors.push({ line: head.line, message: 'QUOTE_MIXED_HEADER' });
      continue;
    }
    const partner = await findPartnerForImport(ctx, { name: head.value.customer, phone: head.value.customer, nif: head.value.customer });
    if (partner === null || partner === 'ambiguous') {
      errors.push({ line: head.line, message: partner === 'ambiguous' ? 'CUSTOMER_AMBIGUOUS' : 'CUSTOMER_NOT_FOUND' });
      continue;
    }

    const lines: SaleLineInput[] = [];
    let failed = false;
    for (const row of rows) {
      const product = await findProductBySku(ctx, row.value.productCode);
      if (!product) {
        errors.push({ line: row.line, message: 'PRODUCT_NOT_FOUND' });
        failed = true;
        continue;
      }
      lines.push({
        productId: product.id,
        description: product.name,
        quantity: row.value.quantity,
        unitPrice: row.value.unitPrice,
        discount: row.value.discount ?? '0',
        taxId: null,
      });
    }
    if (failed) continue;

    const saved = await createSaleOrder(ctx, {
      partnerId: partner.id,
      orderDate: head.value.date,
      validityDate: null,
      note: null,
      lines,
    });
    if (!saved.ok) {
      errors.push({ line: head.line, message: saved.error.message });
      continue;
    }
    created++;
  }
  return ok({ created, errors });
}

const quoteTarget = defineTarget({
  name: 'sales.quote',
  entity: importEntity('sales.quote', ['orderRef', 'customer', 'productCode', 'quantity', 'unitPrice', 'discount', 'date']),
  writePerm: 'sales.order.write',
  fieldKeys: ['orderRef', 'customer', 'productCode', 'quantity', 'unitPrice', 'discount', 'date'],
  requiredKeys: ['orderRef', 'customer', 'productCode', 'quantity', 'unitPrice', 'date'],
  duplicateKeyLabel: 'io.import.dup_key_none',
  example: {
    orderRef: 'DEV-001', customer: 'Entreprise Exemple SARL', productCode: 'CIM-001', quantity: '10',
    unitPrice: '1800,00', discount: '5', date: '2026-10-10',
  },
  schema: quoteSchema,
  keysOf: () => [],
  wholeFile: { commit: (ctx, items) => commitQuotes(ctx, items) },
});

export const IMPORT_TARGETS: Record<ImportEntityName, ImportTarget> = {
  'contacts.partner': partnerTarget,
  'products.product': productTarget,
  'crm.lead': leadTarget,
  'inventory.opening_stock': openingStockTarget,
  'accounting.chart_account': chartAccountTarget,
  'accounting.opening_balance': openingBalanceTarget,
  'sales.quote': quoteTarget,
};

export function isImportEntity(name: string): name is ImportEntityName {
  return (IMPORT_ENTITY_NAMES as readonly string[]).includes(name);
}

/** Mapping fields for the wizard: labels for the current locale, and all three labels as aliases. */
export function importFieldsFor(target: ImportTarget, locale: 'fr' | 'ar' | 'en'): ImportField[] {
  return target.fieldKeys.map((key) => {
    const field = fieldDef(target.entity, key);
    const labelKey = field?.label ?? key;
    return {
      key,
      label: translateKey(labelKey, locale),
      aliases: [translateKey(labelKey, 'fr'), translateKey(labelKey, 'ar'), translateKey(labelKey, 'en')],
      required: target.requiredKeys.includes(key),
    };
  });
}

/** CSV template: French header row and one French example row, in field order. */
export function importTemplateRows(target: ImportTarget): { header: string[]; example: string[] } {
  return {
    header: target.fieldKeys.map((key) => translateKey(fieldDef(target.entity, key)?.label ?? key, 'fr')),
    example: target.fieldKeys.map((key) => target.example[key] ?? ''),
  };
}
