import { describe, expect, it } from 'vitest';
import { err, ok } from './result';

describe('result helpers', () => {
  it('ok wraps a value', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
  });

  it('err builds an AppError shape', () => {
    const r = err('NOT_FOUND', 'x');
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error.code).toBe('NOT_FOUND');
    expect(r.ok === false && r.error.message).toBe('x');
  });
});
