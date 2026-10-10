import type { ZodType } from 'zod';
import { z } from 'zod';
import type { Ctx } from '@/core/ctx';
import type { EntityDef } from '@/core/entities/types';
import { normalizeHeader, parseBooleanText, validateRow, type ImportField, type RowIssue } from '@/core/io';
import { err, type Result } from '@/core/result';
import { translateKey } from '@/ui/views/format';
import { leadEntity } from '@/modules/crm/entities';
import { createLead, leadInput } from '@/modules/crm/service/leads';
import { partnerEntity } from '@/modules/contacts/entities';
import { createPartner, normalizePartner, normalizePhone, partnerDedupeKeys, partnerInput } from '@/modules/contacts/service/partners';
import { productEntity } from '@/modules/products/entities';
import { createProduct, productInput, productSkuKeys } from '@/modules/products/service/products';
import { uomOptions } from '@/modules/products/service/uoms';

export const IMPORT_ENTITY_NAMES = ['contacts.partner', 'products.product', 'crm.lead'] as const;
export type ImportEntityName = (typeof IMPORT_ENTITY_NAMES)[number];

export type ParsedRow =
  | { ok: true; keys: string[]; create: (ctx: Ctx) => Promise<Result<{ id: string }>> }
  | { ok: false; issues: RowIssue[] };

export interface ImportTarget {
  name: ImportEntityName;
  entity: EntityDef;
  writePerm: string;
  fieldKeys: readonly string[];      // column order in the mapping and preview
  requiredKeys: readonly string[];
  duplicateKeyLabel: string;         // i18n key describing the duplicate rule
  existingKeys?: (ctx: Ctx) => Promise<Set<string>>;
  parse: (raw: Record<string, string>) => ParsedRow;
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
  schema: ZodType<T>;
  prepare?: (raw: Record<string, string>, base: Record<string, unknown>) => Record<string, unknown>;
  /** Business rules that the service applies before writing, run here so the preview reports them. */
  check?: (value: T) => Result<unknown>;
  keysOf: (value: T) => string[];
  create: (ctx: Ctx, value: T) => Promise<Result<{ id: string }>>;
  existingKeys?: (ctx: Ctx) => Promise<Set<string>>;
}): ImportTarget {
  return {
    name: cfg.name,
    entity: cfg.entity,
    writePerm: cfg.writePerm,
    fieldKeys: cfg.fieldKeys,
    requiredKeys: cfg.requiredKeys,
    duplicateKeyLabel: cfg.duplicateKeyLabel,
    existingKeys: cfg.existingKeys,
    parse: (raw) => {
      const base = prepareRaw(cfg.entity, cfg.fieldKeys, raw);
      const prepared = cfg.prepare ? cfg.prepare(raw, base) : base;
      const checked = validateRow(cfg.schema, prepared);
      if (!checked.ok) return checked;
      const value = checked.value;
      if (cfg.check) {
        const rule = cfg.check(value);
        if (!rule.ok) return { ok: false, issues: [{ field: rule.error.details?.field ? String(rule.error.details.field) : '', message: rule.error.message }] };
      }
      return { ok: true, keys: cfg.keysOf(value), create: (ctx) => cfg.create(ctx, value) };
    },
  };
}

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
  schema: leadInput,
  keysOf: () => [],
  create: (ctx, v) => createLead(ctx, v),
});

export const IMPORT_TARGETS: Record<ImportEntityName, ImportTarget> = {
  'contacts.partner': partnerTarget,
  'products.product': productTarget,
  'crm.lead': leadTarget,
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

export const importInputBase = z.object({
  entity: z.string(),
  mapping: z.record(z.string(), z.number().int().nonnegative().nullable()),
});
