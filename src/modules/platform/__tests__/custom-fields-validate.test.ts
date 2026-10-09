import { describe, expect, it } from 'vitest';
import { validateCustomValues, type CustomFieldRule } from '../service/custom-fields-validate';

const rules: CustomFieldRule[] = [
  { key: 'vip', fieldType: 'boolean', required: false },
  { key: 'shoe_size', fieldType: 'number', required: false },
  { key: 'birthday', fieldType: 'date', required: false },
  { key: 'segment', fieldType: 'select', required: false, options: ['gold', 'silver'] },
  { key: 'note', fieldType: 'text', required: true },
];

describe('validateCustomValues', () => {
  it('accepts valid values and drops unknown keys', () => {
    const r = validateCustomValues(rules, {
      vip: 'on',
      shoe_size: '42.5',
      birthday: '1990-02-28',
      segment: 'gold',
      note: '  hello  ',
      hacker: 'x',
    });
    expect(r).toEqual({
      ok: true,
      values: { vip: true, shoe_size: '42.5', birthday: '1990-02-28', segment: 'gold', note: 'hello' },
    });
  });

  it('stores null for empty optional fields and false for empty booleans', () => {
    const r = validateCustomValues(rules, { note: 'x' });
    expect(r).toEqual({
      ok: true,
      values: { vip: false, shoe_size: null, birthday: null, segment: null, note: 'x' },
    });
  });

  it('requires required fields', () => {
    const r = validateCustomValues(rules, { note: '   ' });
    expect(r).toEqual({ ok: false, errors: { note: 'required' } });
  });

  it.each([
    ['shoe_size', 'abc'],
    ['shoe_size', '1e3'],
    ['birthday', '2026-02-30'],
    ['birthday', '28/02/1990'],
    ['segment', 'platinum'],
    ['vip', 'maybe'],
  ])('rejects %s = %s', (key, value) => {
    const r = validateCustomValues(rules, { note: 'x', [key]: value });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[key]).toBeDefined();
  });

  it('rejects overlong text', () => {
    const r = validateCustomValues(rules, { note: 'x'.repeat(2001) });
    expect(r).toEqual({ ok: false, errors: { note: 'invalid_text' } });
  });
});
