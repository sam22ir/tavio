import { describe, expect, it } from 'vitest';
import { isCheckViolation, isUniqueViolation } from '../service/db-errors';

describe('chatter db error mapping', () => {
  it('recognises unique and check violations by Postgres code', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation({ code: '23514' })).toBe(false);
    expect(isCheckViolation({ code: '23514' })).toBe(true);
    expect(isCheckViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
