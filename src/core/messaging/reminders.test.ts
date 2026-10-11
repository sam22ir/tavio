import { describe, expect, it } from 'vitest';
import { daysBetween, partitionByOptOut, planReminders, reminderDedupeKey, type ReminderCandidate } from './reminders';
import { normalizeSettings } from './service';

const base = { contractRef: 'CRD-1', partnerName: 'Client', partnerId: 'p', contractId: 'c1', installmentId: 'i1', remainingCents: 1000n };
const settings = { remindersEnabled: true, beforeDays: 3, overdueDays: [1, 7] };
const TODAY = '2026-10-11';

function row(over: Partial<ReminderCandidate>): ReminderCandidate {
  return { ...base, dueDate: TODAY, partnerEmail: 'client@example.test', ...over };
}

describe('reminder planning', () => {
  it('counts whole days in UTC', () => {
    expect(daysBetween('2026-10-11', '2026-10-14')).toBe(3);
    expect(daysBetween('2026-10-11', '2026-10-10')).toBe(-1);
  });

  it('plans the before reminder exactly beforeDays ahead', () => {
    const plan = planReminders([row({ dueDate: '2026-10-14' })], settings, TODAY);
    expect(plan.map((p) => [p.templateKey, p.offset])).toEqual([['installment_reminder_before', 3]]);
  });

  it('plans overdue reminders at 1 and 7 days late only', () => {
    const late1 = planReminders([row({ dueDate: '2026-10-10' })], settings, TODAY);
    const late7 = planReminders([row({ dueDate: '2026-10-04' })], settings, TODAY);
    const late3 = planReminders([row({ dueDate: '2026-10-08' })], settings, TODAY);
    expect(late1.map((p) => p.offset)).toEqual([1]);
    expect(late7.map((p) => p.offset)).toEqual([7]);
    expect(late3).toEqual([]);
  });

  it('skips partners without an email (they keep the activity flow)', () => {
    expect(planReminders([row({ dueDate: '2026-10-14', partnerEmail: null })], settings, TODAY)).toEqual([]);
  });

  it('gives the same dedupe key for the same contract, installment, template and offset', () => {
    const a = planReminders([row({ dueDate: '2026-10-10' })], settings, TODAY)[0];
    const b = planReminders([row({ dueDate: '2026-10-11' })], settings, '2026-10-12')[0];
    expect(a?.dedupeKey).toBe(reminderDedupeKey('c1', 'i1', 'installment_overdue', 1));
    expect(a?.dedupeKey).toBe(b?.dedupeKey);
    expect(reminderDedupeKey('c1', 'i1', 'installment_overdue', 1)).not.toBe(reminderDedupeKey('c1', 'i1', 'installment_overdue', 7));
  });
});

describe('reminder settings validation', () => {
  it('sorts and de-duplicates overdue days', () => {
    const res = normalizeSettings({ remindersEnabled: true, beforeDays: 3, overdueDays: [7, 1, 7] });
    expect(res).toEqual({ ok: true, value: { remindersEnabled: true, beforeDays: 3, overdueDays: [1, 7] } });
  });

  it('rejects out-of-range offsets', () => {
    expect(normalizeSettings({ remindersEnabled: true, beforeDays: 31, overdueDays: [] }).ok).toBe(false);
    expect(normalizeSettings({ remindersEnabled: true, beforeDays: 3, overdueDays: [61] }).ok).toBe(false);
    expect(normalizeSettings({ remindersEnabled: true, beforeDays: 3, overdueDays: [1, 2, 3, 4, 5, 6] }).ok).toBe(false);
  });
});

describe('opt-out skip', () => {
  it('skips reminders for partners who opted out of email and keeps the rest', () => {
    const plan = planReminders(
      [row({ dueDate: '2026-10-14', partnerId: 'opted' }), row({ dueDate: '2026-10-14', partnerId: 'ok', contractId: 'c2' })],
      settings,
      TODAY,
    );
    const { send, optedOut } = partitionByOptOut(plan, new Set(['opted']));
    expect(send.map((p) => p.candidate.partnerId)).toEqual(['ok']);
    expect(optedOut.map((p) => p.candidate.partnerId)).toEqual(['opted']);
  });
});
