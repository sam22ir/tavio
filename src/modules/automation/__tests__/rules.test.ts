import { describe, expect, it } from 'vitest';
import { actionConfigSchemas } from '../config';
import { renderTemplate } from '../engine';
import { toRuleInput } from '../form';
import { ruleInput } from '../service/rules';

const base = {
  name: 'Thank big payers',
  triggerEvent: 'invoicing.payment.registered',
  conditions: [{ field: 'amountCents', op: 'gte', value: '100000' }],
  active: true,
};

describe('renderTemplate', () => {
  it('fills placeholders and blanks missing or object values', () => {
    const payload = { amountCents: '100000', partner: { id: 'x' } };
    expect(renderTemplate('Paid {amountCents} by {partner} ref {missing}', payload)).toBe('Paid 100000 by  ref ');
  });
});

describe('ruleInput', () => {
  it('accepts a webhook rule with an https url', () => {
    const r = ruleInput.safeParse({ ...base, action: 'webhook', actionConfig: { url: 'https://example.dz/hook' } });
    expect(r.success).toBe(true);
  });

  it('rejects a webhook url that is not https', () => {
    const r = ruleInput.safeParse({ ...base, action: 'webhook', actionConfig: { url: 'http://example.dz/hook' } });
    expect(r.success).toBe(false);
  });

  it('rejects an action config that does not match its action', () => {
    const r = ruleInput.safeParse({ ...base, action: 'post_note', actionConfig: { url: 'https://x.dz' } });
    expect(r.success).toBe(false);
  });

  it('rejects an unknown trigger event', () => {
    const r = ruleInput.safeParse({ ...base, triggerEvent: 'made.up', action: 'webhook', actionConfig: { url: 'https://x.dz' } });
    expect(r.success).toBe(false);
  });
});

describe('toRuleInput', () => {
  it('maps the flat form onto a rule with one condition', () => {
    const input = toRuleInput({
      name: 'Note big sales',
      triggerEvent: 'pos.order.paid',
      condField: 'totalCents',
      condOp: 'gt',
      condValue: '5000',
      action: 'post_note',
      entity: 'pos.order',
      recordIdField: 'orderId',
      body: 'Sale {totalCents}',
      dueInDays: '0',
      typeKey: '',
      summary: '',
      url: '',
      active: 'on',
    });
    expect(input.conditions).toEqual([{ field: 'totalCents', op: 'gt', value: '5000' }]);
    expect(input.actionConfig).toEqual({ entity: 'pos.order', recordIdField: 'orderId', body: 'Sale {totalCents}' });
    expect(input.active).toBe(true);
    expect(actionConfigSchemas.post_note.safeParse(input.actionConfig).success).toBe(true);
  });

  it('gives no conditions when the condition field is empty', () => {
    const input = toRuleInput({
      name: 'x', triggerEvent: 'pos.order.paid', condField: '', condOp: 'eq', condValue: '',
      action: 'webhook', url: 'https://x.dz', entity: '', recordIdField: '', typeKey: '', summary: '',
      dueInDays: '0', body: '', active: undefined,
    });
    expect(input.conditions).toEqual([]);
    expect(input.active).toBe(false);
  });
});
