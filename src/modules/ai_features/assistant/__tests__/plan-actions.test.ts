import { describe, expect, it } from 'vitest';
import { planActionKinds, planActionProposals, planToolCalls, TOOL_DESCRIPTIONS, ASSISTANT_TOOL_NAMES } from '../plan';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('planActionKinds', () => {
  it('reads kinds written as strings or as objects', () => {
    expect(planActionKinds('{"tools":["overdue"],"actions":["reminder_batch"]}')).toEqual(['reminder_batch']);
    expect(planActionKinds('{"tools":["overdue"],"actions":[{"kind":"draft_invoice"}]}')).toEqual(['draft_invoice']);
  });

  it('drops unknown kinds and duplicates', () => {
    expect(planActionKinds('{"actions":["wire_money","reminder_batch","reminder_batch"]}')).toEqual(['reminder_batch']);
  });

  it('returns nothing when there is no actions list', () => {
    expect(planActionKinds('{"tools":["kpis"]}')).toEqual([]);
    expect(planActionKinds('not json')).toEqual([]);
  });
});

describe('planActionProposals', () => {
  const allowed = new Set([uuid(1), uuid(2)]);

  it('keeps a valid reminder batch built from allowed IDs', () => {
    const reply = JSON.stringify({ actions: [{ kind: 'reminder_batch', contractIds: [uuid(1), uuid(2)] }] });
    expect(planActionProposals(reply, allowed)).toEqual([{ kind: 'reminder_batch', contractIds: [uuid(1), uuid(2)] }]);
  });

  it('drops a batch of more than 10 contracts', () => {
    const ids = Array.from({ length: 11 }, (_, i) => uuid(i + 1));
    const reply = JSON.stringify({ actions: [{ kind: 'reminder_batch', contractIds: ids }] });
    expect(planActionProposals(reply, new Set(ids))).toEqual([]);
  });

  it('drops an invented partner ID for a draft invoice', () => {
    const reply = JSON.stringify({
      actions: [{ kind: 'draft_invoice', partnerId: uuid(99), lines: [{ description: 'x', quantity: '1', unitPriceCents: '100' }] }],
    });
    expect(planActionProposals(reply, allowed)).toEqual([]);
  });
});

describe('planToolCalls with the collections tool', () => {
  it('accepts collections_queue and keeps the tool list in step with its descriptions', () => {
    expect(planToolCalls('{"tools":["collections_queue"]}')).toEqual(['collections_queue']);
    for (const name of ASSISTANT_TOOL_NAMES) expect(TOOL_DESCRIPTIONS[name]).toBeTruthy();
  });
});
