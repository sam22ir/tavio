import { and, asc, eq } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { partners } from '@/modules/contacts/schema';
import { customFieldDefs, type CustomFieldDef } from '../schema';
import { CUSTOM_FIELD_TYPES, type CustomFieldType } from '../constants';
import { validateCustomValues, type CustomValues } from './custom-fields-validate';
import type { CustomEntity } from '../constants';

/** Entities that accept custom fields, with the table holding their `custom` jsonb column. */
export { CUSTOM_ENTITIES, type CustomEntity } from '../constants';

const READ = 'platform.custom_field.read';
const WRITE = 'platform.custom_field.write';
const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;

export interface CustomFieldDefInput {
  entity: CustomEntity;
  key: string;
  labelFr: string;
  labelAr: string;
  labelEn: string;
  fieldType: CustomFieldType;
  options?: string[];
  required: boolean;
  position: number;
}

export function validateFieldDefInput(input: CustomFieldDefInput): Result<CustomFieldDefInput> {
  if (!KEY_RE.test(input.key)) return err('VALIDATION', 'key must be snake_case, 40 characters max');
  if (!(CUSTOM_FIELD_TYPES as readonly string[]).includes(input.fieldType)) {
    return err('VALIDATION', 'unknown field type');
  }
  if (input.fieldType === 'select') {
    const options = input.options ?? [];
    if (options.length === 0 || new Set(options).size !== options.length) {
      return err('VALIDATION', 'select fields need unique options');
    }
  }
  return ok(input);
}

export async function listCustomFieldDefs(ctx: Ctx, entity: CustomEntity): Promise<Result<CustomFieldDef[]>> {
  const perm = requirePerm(ctx, READ);
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select()
    .from(customFieldDefs)
    .where(and(eq(customFieldDefs.companyId, ctx.companyId), eq(customFieldDefs.entity, entity)))
    .orderBy(asc(customFieldDefs.position), asc(customFieldDefs.key));
  return ok(rows);
}

export async function createCustomFieldDef(ctx: Ctx, input: CustomFieldDefInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, WRITE);
  if (!perm.ok) return perm;
  const valid = validateFieldDefInput(input);
  if (!valid.ok) return valid;

  const existing = await ctx.tx
    .select({ id: customFieldDefs.id })
    .from(customFieldDefs)
    .where(
      and(
        eq(customFieldDefs.companyId, ctx.companyId),
        eq(customFieldDefs.entity, input.entity),
        eq(customFieldDefs.key, input.key),
      ),
    );
  if (existing.length > 0) return err('CONFLICT', 'a field with this key already exists');

  const [row] = await ctx.tx
    .insert(customFieldDefs)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      entity: input.entity,
      key: input.key,
      labelFr: input.labelFr,
      labelAr: input.labelAr,
      labelEn: input.labelEn,
      fieldType: input.fieldType,
      options: input.fieldType === 'select' ? input.options ?? [] : null,
      required: input.required,
      position: input.position,
    })
    .returning({ id: customFieldDefs.id });
  if (!row) return err('INTERNAL', 'insert returned no row');

  await audit(ctx, { entity: 'platform.custom_field', recordId: row.id, action: 'create', after: input });
  return ok({ id: row.id });
}

/** Removes a definition. Stored values stay in the `custom` jsonb and are simply no longer shown. */
export async function deleteCustomFieldDef(ctx: Ctx, id: string): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, WRITE);
  if (!perm.ok) return perm;
  const [row] = await ctx.tx
    .delete(customFieldDefs)
    .where(and(eq(customFieldDefs.id, id), eq(customFieldDefs.companyId, ctx.companyId)))
    .returning({ id: customFieldDefs.id, entity: customFieldDefs.entity, key: customFieldDefs.key });
  if (!row) return err('NOT_FOUND', 'custom field not found');
  await audit(ctx, { entity: 'platform.custom_field', recordId: row.id, action: 'delete', before: row });
  return ok({ id: row.id });
}

/** Validates against the definitions and merges the values into the record's `custom` jsonb. */
export async function setCustomValues(
  ctx: Ctx,
  input: { entity: CustomEntity; recordId: string; values: Record<string, unknown> },
): Promise<Result<{ recordId: string }>> {
  const perm = requirePerm(ctx, 'contacts.partner.write');
  if (!perm.ok) return perm;

  const defs = await ctx.tx
    .select()
    .from(customFieldDefs)
    .where(and(eq(customFieldDefs.companyId, ctx.companyId), eq(customFieldDefs.entity, input.entity)));

  const checked = validateCustomValues(
    defs.map((d) => ({
      key: d.key,
      fieldType: d.fieldType as CustomFieldType,
      required: d.required,
      options: (d.options as string[] | null) ?? null,
    })),
    input.values,
  );
  if (!checked.ok) {
    return err('VALIDATION', 'invalid custom values', { fieldErrors: checked.errors });
  }

  const [record] = await ctx.tx
    .select({ custom: partners.custom })
    .from(partners)
    .where(and(eq(partners.id, input.recordId), eq(partners.companyId, ctx.companyId)))
    .for('update');
  if (!record) return err('NOT_FOUND', 'record not found');

  const defKeys = new Set(defs.map((d) => d.key));
  const current = (record.custom ?? {}) as CustomValues;
  const merged: CustomValues = { ...current };
  for (const [key, value] of Object.entries(checked.values)) {
    if (defKeys.has(key)) merged[key] = value;
  }

  await ctx.tx
    .update(partners)
    .set({ custom: merged, updatedAt: new Date() })
    .where(and(eq(partners.id, input.recordId), eq(partners.companyId, ctx.companyId)));

  await audit(ctx, {
    entity: 'contacts.partner',
    recordId: input.recordId,
    action: 'update',
    before: { custom: current },
    after: { custom: merged },
  });
  return ok({ recordId: input.recordId });
}
