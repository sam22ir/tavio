import { describe, expect, it } from 'vitest';
import { buildReminderPrompt, validateReminderMessage } from '../prompt';

const data = {
  partnerName: 'Karim',
  shopName: 'Boutique Test',
  amountCents: 150000n,
  dueDate: '2026-09-01',
  contractNumber: 'CR-0007',
  daysLate: 12,
};

describe('buildReminderPrompt', () => {
  it('includes the amount, shop name and language instruction', () => {
    const p = buildReminderPrompt(data, '1 500,00 DA', 'firm', 'darija');
    expect(p.user).toContain('1 500,00 DA');
    expect(p.user).toContain('Boutique Test');
    expect(p.system).toContain('Arabic script');
    expect(p.user).toContain('Days late: 12');
  });
});

describe('validateReminderMessage', () => {
  it('accepts a message that carries the amount', () => {
    expect(validateReminderMessage(' Bonjour, 1500 DA dus. ', '1 500 DA')).toBe('Bonjour, 1500 DA dus.');
  });
  it('rejects empty, non-string and too long messages', () => {
    expect(validateReminderMessage('   ', '1500')).toBeNull();
    expect(validateReminderMessage(42, '1500')).toBeNull();
    expect(validateReminderMessage('1500 ' + 'a'.repeat(400), '1500')).toBeNull();
  });
  it('rejects a message without the amount', () => {
    expect(validateReminderMessage('Bonjour, merci.', '1500 DA')).toBeNull();
  });
  it('rejects threatening wording', () => {
    expect(validateReminderMessage('1500 DA, sinon le tribunal.', '1500 DA')).toBeNull();
  });
});
