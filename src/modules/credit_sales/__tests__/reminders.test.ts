import { describe, expect, it } from 'vitest';
import {
  buildReminderMessage,
  normalizeAlgerianPhone,
  whatsappLink,
  type ReminderData,
} from '../service/reminders';

const base: ReminderData = {
  partnerName: 'Karim',
  shopName: 'Boutique Test',
  amountCents: 150000n,
  dueDate: '2026-10-10',
  contractNumber: 'CR-0042',
  daysLate: 0,
};

describe('normalizeAlgerianPhone', () => {
  it.each([
    ['0555123456', '213555123456'],
    ['0661234567', '213661234567'],
    ['0771234567', '213771234567'],
    ['+213 555 12 34 56', '213555123456'],
    ['00213555123456', '213555123456'],
    ['0555-12-34-56', '213555123456'],
  ])('normalises %s to %s', (input, expected) => {
    expect(normalizeAlgerianPhone(input)).toBe(expected);
  });

  it.each([null, '', '0255123456', '0555123', '+33612345678', '+0555123456', '12345', 'abc'])(
    'rejects %s',
    (input) => {
      expect(normalizeAlgerianPhone(input)).toBeNull();
    },
  );
});

describe('whatsappLink', () => {
  it('builds an encoded wa.me link', () => {
    expect(whatsappLink('0555123456', 'Bonjour à tous')).toBe(
      `https://wa.me/213555123456?text=${encodeURIComponent('Bonjour à tous')}`,
    );
  });

  it('returns null for an unusable phone', () => {
    expect(whatsappLink(null, 'hi')).toBeNull();
    expect(whatsappLink('0255123456', 'hi')).toBeNull();
  });
});

describe('buildReminderMessage', () => {
  it('fr due soon mentions the shop, contract, amount and due date', () => {
    const text = buildReminderMessage('fr', base);
    expect(text).toContain('Boutique Test');
    expect(text).toContain('CR-0042');
    expect(text).toContain('2026-10-10');
    expect(text).toContain('échéance');
    expect(text).not.toContain('retard');
  });

  it('fr overdue mentions the days late', () => {
    const text = buildReminderMessage('fr', { ...base, daysLate: 4 });
    expect(text).toContain('retard de 4 jour(s)');
    expect(text).toContain('CR-0042');
  });

  it('ar uses Arabic script, the contract number and the days late', () => {
    const soon = buildReminderMessage('ar', base);
    const late = buildReminderMessage('ar', { ...base, daysLate: 2 });
    expect(soon).toMatch(/[؀-ۿ]/);
    expect(soon).toContain('CR-0042');
    expect(late).toContain('متأخر منذ 2 يوم');
    expect(late).toContain('Boutique Test');
  });

  it('en due soon and overdue wording differ', () => {
    const soon = buildReminderMessage('en', base);
    const late = buildReminderMessage('en', { ...base, daysLate: 3 });
    expect(soon).toContain('is due on 2026-10-10');
    expect(late).toContain('3 day(s) overdue');
    expect(late).toContain('CR-0042');
  });
});
