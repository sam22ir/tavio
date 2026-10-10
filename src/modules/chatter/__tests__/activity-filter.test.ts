import { describe, expect, it } from 'vitest';
import {
  DEADLINE_CLASS,
  deadlineTone,
  matchesActivityFilter,
  parseActivityFilter,
} from '../ui/activity-filter';

const TODAY = '2026-10-10';

describe('parseActivityFilter', () => {
  it('keeps known filters', () => {
    expect(parseActivityFilter('today')).toBe('today');
    expect(parseActivityFilter('overdue')).toBe('overdue');
    expect(parseActivityFilter('planned')).toBe('planned');
    expect(parseActivityFilter('all')).toBe('all');
  });

  it('falls back to all for unknown or missing values', () => {
    expect(parseActivityFilter(undefined)).toBe('all');
    expect(parseActivityFilter('')).toBe('all');
    expect(parseActivityFilter('Today')).toBe('all');
    expect(parseActivityFilter('__proto__')).toBe('all');
  });
});

describe('matchesActivityFilter', () => {
  it('splits due dates into overdue, today and planned', () => {
    expect(matchesActivityFilter('overdue', '2026-10-09', TODAY)).toBe(true);
    expect(matchesActivityFilter('overdue', TODAY, TODAY)).toBe(false);
    expect(matchesActivityFilter('today', TODAY, TODAY)).toBe(true);
    expect(matchesActivityFilter('today', '2026-10-11', TODAY)).toBe(false);
    expect(matchesActivityFilter('planned', '2026-10-11', TODAY)).toBe(true);
    expect(matchesActivityFilter('planned', TODAY, TODAY)).toBe(false);
  });

  it('shows everything under all', () => {
    expect(matchesActivityFilter('all', '2000-01-01', TODAY)).toBe(true);
    expect(matchesActivityFilter('all', '2100-01-01', TODAY)).toBe(true);
  });
});

describe('deadlineTone and DEADLINE_CLASS', () => {
  it('maps due dates to a tone', () => {
    expect(deadlineTone('2026-10-09', TODAY)).toBe('overdue');
    expect(deadlineTone(TODAY, TODAY)).toBe('today');
    expect(deadlineTone('2026-10-11', TODAY)).toBe('planned');
  });

  it('gives each tone its own colour class', () => {
    expect(DEADLINE_CLASS.overdue).toContain('text-red-600');
    expect(DEADLINE_CLASS.today).toContain('text-amber-600');
    expect(DEADLINE_CLASS.planned).toContain('text-emerald-600');
  });
});
