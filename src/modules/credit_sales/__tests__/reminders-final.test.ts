import { describe, expect, it } from 'vitest';
import { formatDzd } from '@/core/money';
import { validateReminderMessage } from '@/modules/ai_features/reminders/prompt';
import { buildReminderMessage, type ReminderData } from '../service/reminders';

const data: ReminderData = {
  partnerName: 'Karim',
  shopName: 'Boutique Test',
  amountCents: 150000n,
  dueDate: '2026-09-01',
  contractNumber: 'CR-0042',
  daysLate: 21,
  stage: 'final',
};

describe('final reminder wording', () => {
  it.each(['fr', 'ar', 'en'] as const)('%s text carries the amount, contract and shop name', (locale) => {
    const text = buildReminderMessage(locale, data);
    expect(text).toContain(formatDzd(data.amountCents, locale));
    expect(text).toContain('CR-0042');
    expect(text).toContain('Boutique Test');
  });

  it.each(['fr', 'ar', 'en'] as const)('%s text passes the reminder validator, so it is never blocked', (locale) => {
    const text = buildReminderMessage(locale, data);
    expect(validateReminderMessage(text, formatDzd(data.amountCents, locale))).toBe(text);
    expect(text.length).toBeLessThanOrEqual(400);
  });

  it('keeps the default wording when no stage is set', () => {
    const plain: ReminderData = { ...data, stage: undefined };
    expect(buildReminderMessage('en', plain)).toContain('overdue');
    expect(buildReminderMessage('en', plain)).not.toContain('Final reminder');
  });
});
