import { describe, expect, it } from 'vitest';
import {
  attendanceMinutes,
  canTransitionLeave,
  countLeaveDays,
  isIsoDate,
  minutesToHours,
  summarizeAttendance,
} from '../logic';

describe('isIsoDate', () => {
  it('accepts real calendar dates only', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-1-01')).toBe(false);
  });
});

describe('countLeaveDays', () => {
  it('counts both ends inclusively', () => {
    expect(countLeaveDays('2026-03-01', '2026-03-01')).toBe('1.000');
    expect(countLeaveDays('2026-03-01', '2026-03-05')).toBe('5.000');
  });
  it('crosses month and leap-day boundaries', () => {
    expect(countLeaveDays('2024-02-28', '2024-03-01')).toBe('3.000');
  });
  it('rejects reversed or invalid ranges', () => {
    expect(countLeaveDays('2026-03-05', '2026-03-01')).toBeNull();
    expect(countLeaveDays('bad', '2026-03-01')).toBeNull();
  });
});

describe('canTransitionLeave', () => {
  it('follows draft -> submitted -> approved | refused', () => {
    expect(canTransitionLeave('draft', 'submitted')).toBe(true);
    expect(canTransitionLeave('submitted', 'approved')).toBe(true);
    expect(canTransitionLeave('submitted', 'refused')).toBe(true);
  });
  it('blocks skipped, backward and terminal moves', () => {
    expect(canTransitionLeave('draft', 'approved')).toBe(false);
    expect(canTransitionLeave('approved', 'refused')).toBe(false);
    expect(canTransitionLeave('refused', 'submitted')).toBe(false);
    expect(canTransitionLeave('submitted', 'draft')).toBe(false);
  });
});

describe('attendance', () => {
  const t0 = new Date('2026-05-10T08:00:00Z');
  it('computes whole minutes and null while open', () => {
    expect(attendanceMinutes(t0, new Date('2026-05-10T09:30:45Z'))).toBe(90);
    expect(attendanceMinutes(t0, null)).toBeNull();
    expect(attendanceMinutes(t0, new Date('2026-05-10T07:00:00Z'))).toBeNull();
  });
  it('summarizes per employee for one month and counts open spans', () => {
    const rows = summarizeAttendance(
      [
        { employeeId: 'a', checkIn: t0, checkOut: new Date('2026-05-10T10:00:00Z') },
        { employeeId: 'a', checkIn: new Date('2026-05-11T08:00:00Z'), checkOut: new Date('2026-05-11T09:00:00Z') },
        { employeeId: 'a', checkIn: new Date('2026-06-01T08:00:00Z'), checkOut: new Date('2026-06-01T09:00:00Z') },
        { employeeId: 'b', checkIn: t0, checkOut: null },
      ],
      '2026-05',
    );
    expect(rows).toEqual([
      { employeeId: 'a', daysPresent: 2, minutes: 180, openCount: 0 },
      { employeeId: 'b', daysPresent: 1, minutes: 0, openCount: 1 },
    ]);
  });
  it('formats minutes as hours', () => {
    expect(minutesToHours(90)).toBe('1.50');
    expect(minutesToHours(0)).toBe('0.00');
    expect(minutesToHours(100)).toBe('1.67');
  });
});
