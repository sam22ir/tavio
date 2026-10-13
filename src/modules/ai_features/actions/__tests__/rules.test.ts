import { describe, expect, it } from 'vitest';
import {
  FINAL_AFTER_DAYS,
  FIRM_AFTER_DAYS,
  invoiceLineSchema,
  nextReminderStage,
  parseProposals,
  parseStoredPayload,
  proposalSchema,
} from '../rules';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('nextReminderStage', () => {
  it('starts with a polite reminder once an installment is late', () => {
    expect(nextReminderStage(1, [])).toBe('polite');
    expect(nextReminderStage(90, [])).toBe('polite');
  });

  it('returns nothing when no installment is late', () => {
    expect(nextReminderStage(0, [])).toBeNull();
    expect(nextReminderStage(0, ['polite'])).toBeNull();
  });

  it('escalates polite to firm only after the firm threshold', () => {
    expect(nextReminderStage(FIRM_AFTER_DAYS - 1, ['polite'])).toBeNull();
    expect(nextReminderStage(FIRM_AFTER_DAYS, ['polite'])).toBe('firm');
  });

  it('escalates firm to final only after the final threshold', () => {
    expect(nextReminderStage(FINAL_AFTER_DAYS - 1, ['polite', 'firm'])).toBeNull();
    expect(nextReminderStage(FINAL_AFTER_DAYS, ['polite', 'firm'])).toBe('final');
  });

  it('uses the most recent stage, not the first one', () => {
    expect(nextReminderStage(FINAL_AFTER_DAYS, ['polite', 'firm', 'polite'])).toBe('firm');
  });

  it('does not escalate further after final', () => {
    expect(nextReminderStage(200, ['polite', 'firm', 'final'])).toBeNull();
  });
});

describe('parseProposals', () => {
  const allowed = new Set([uuid(1), uuid(2), uuid(3)]);

  it('keeps valid proposals whose IDs were all seen in tool results', () => {
    const out = parseProposals(
      [{ kind: 'reminder_batch', contractIds: [uuid(1), uuid(2)] }],
      allowed,
    );
    expect(out).toEqual([{ kind: 'reminder_batch', contractIds: [uuid(1), uuid(2)] }]);
  });

  it('drops unknown kinds', () => {
    expect(parseProposals([{ kind: 'delete_everything', contractIds: [uuid(1)] }], allowed)).toEqual([]);
  });

  it('rejects a reminder batch over 10 contracts', () => {
    const many = Array.from({ length: 11 }, (_, i) => uuid(i + 1));
    const allAllowed = new Set(many);
    expect(parseProposals([{ kind: 'reminder_batch', contractIds: many }], allAllowed)).toEqual([]);
    const ten = many.slice(0, 10);
    expect(parseProposals([{ kind: 'reminder_batch', contractIds: ten }], allAllowed)).toHaveLength(1);
  });

  it('drops IDs that did not appear in this request', () => {
    expect(parseProposals([{ kind: 'reminder_batch', contractIds: [uuid(9)] }], allowed)).toEqual([]);
  });

  it('drops a batch that lists the same contract twice', () => {
    expect(parseProposals([{ kind: 'reminder_batch', contractIds: [uuid(1), uuid(1)] }], allowed)).toEqual([]);
    expect(parseStoredPayload('reminder_batch', { contractIds: [uuid(1), uuid(1)] })).toBeNull();
  });

  it('keeps the valid items when others are malformed', () => {
    const out = parseProposals(
      [{ kind: 'reminder_batch', contractIds: ['not-a-uuid'] }, { kind: 'reminder_batch', contractIds: [uuid(3)] }],
      allowed,
    );
    expect(out).toHaveLength(1);
  });

  it('returns nothing for a non-array', () => {
    expect(parseProposals({ kind: 'reminder_batch' }, allowed)).toEqual([]);
  });
});

describe('draft_invoice line bounds', () => {
  it('accepts a normal line and coerces numbers to strings', () => {
    const parsed = invoiceLineSchema.safeParse({ description: 'Riz 25kg', quantity: 2, unitPriceCents: 250000 });
    expect(parsed.success).toBe(true);
  });

  it.each([
    { description: '', quantity: '1', unitPriceCents: '100' },
    { description: 'x', quantity: '0', unitPriceCents: '100' },
    { description: 'x', quantity: '-1', unitPriceCents: '100' },
    { description: 'x', quantity: '1', unitPriceCents: '12.5' },
    { description: 'x', quantity: '1', unitPriceCents: '1000000000000000' },
  ])('rejects %j', (line) => {
    expect(invoiceLineSchema.safeParse(line).success).toBe(false);
  });

  it('caps a draft at 20 lines', () => {
    const line = { description: 'x', quantity: '1', unitPriceCents: '100' };
    expect(proposalSchema.safeParse({ kind: 'draft_invoice', partnerId: uuid(1), lines: Array(20).fill(line) }).success).toBe(true);
    expect(proposalSchema.safeParse({ kind: 'draft_invoice', partnerId: uuid(1), lines: Array(21).fill(line) }).success).toBe(false);
  });
});

describe('parseStoredPayload', () => {
  it('returns null for a payload that no longer matches its kind', () => {
    expect(parseStoredPayload('reminder_batch', { contractIds: 'x' })).toBeNull();
    expect(parseStoredPayload('unknown', {})).toBeNull();
  });

  it('parses a valid reminder payload', () => {
    expect(parseStoredPayload('reminder_batch', { contractIds: [uuid(1)] })).toEqual({
      kind: 'reminder_batch',
      contractIds: [uuid(1)],
    });
  });
});
