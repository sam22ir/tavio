import type { CustomFieldType } from '../constants';
export { CUSTOM_FIELD_TYPES, type CustomFieldType } from '../constants';

export interface CustomFieldRule {
  key: string;
  fieldType: CustomFieldType;
  required: boolean;
  options?: readonly string[] | null;
}

export type CustomValues = Record<string, string | number | boolean | null>;

export type CustomValidation =
  | { ok: true; values: CustomValues }
  | { ok: false; errors: Record<string, string> };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;

/**
 * Checks submitted custom values against the field definitions. Unknown keys are dropped.
 * Empty input for an optional field stores null. Values are normalised to their JSON type.
 */
export function validateCustomValues(
  rules: readonly CustomFieldRule[],
  input: Record<string, unknown>,
): CustomValidation {
  const values: CustomValues = {};
  const errors: Record<string, string> = {};

  for (const rule of rules) {
    const raw = typeof input[rule.key] === 'string' ? (input[rule.key] as string).trim() : input[rule.key];
    const empty = raw === undefined || raw === null || raw === '';

    if (empty) {
      if (rule.required && rule.fieldType !== 'boolean') errors[rule.key] = 'required';
      values[rule.key] = rule.fieldType === 'boolean' ? false : null;
      continue;
    }

    switch (rule.fieldType) {
      case 'text': {
        if (typeof raw !== 'string' || raw.length > 2000) errors[rule.key] = 'invalid_text';
        else values[rule.key] = raw;
        break;
      }
      case 'number': {
        const text = String(raw).trim();
        if (!NUMBER_RE.test(text) || !Number.isFinite(Number(text))) errors[rule.key] = 'invalid_number';
        else values[rule.key] = text;
        break;
      }
      case 'date': {
        const text = String(raw).trim();
        const parsed = DATE_RE.test(text) ? new Date(`${text}T00:00:00Z`) : null;
        if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
          errors[rule.key] = 'invalid_date';
        } else values[rule.key] = text;
        break;
      }
      case 'boolean': {
        if (raw === true || raw === 'true' || raw === 'on') values[rule.key] = true;
        else if (raw === false || raw === 'false' || raw === 'off') values[rule.key] = false;
        else errors[rule.key] = 'invalid_boolean';
        break;
      }
      case 'select': {
        const text = String(raw);
        if (!rule.options?.includes(text)) errors[rule.key] = 'invalid_option';
        else values[rule.key] = text;
        break;
      }
    }
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, values };
}
