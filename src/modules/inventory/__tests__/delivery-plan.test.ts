import { describe, expect, it } from 'vitest';
import {
  DELIVERY_NOTHING_DELIVERED,
  DELIVERY_QTY_INVALID,
  DELIVERY_QTY_OVER,
  planDeliveryValidation,
} from '../service/delivery-plan';

const lines = [
  { id: 'a', quantity: '5' },
  { id: 'b', quantity: '2.500' },
];

describe('planDeliveryValidation', () => {
  it('delivers everything by default and creates no backorder', () => {
    const r = planDeliveryValidation({ lines, delivered: {}, noBackorder: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.lines.map((l) => l.deliveredQty)).toEqual(['5.000', '2.500']);
    expect(r.value.backorder).toBe(false);
    expect(r.value.backorderLines).toEqual([]);
  });

  it('splits the remainder into a backorder when short', () => {
    const r = planDeliveryValidation({ lines, delivered: { a: '3' }, noBackorder: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.backorder).toBe(true);
    expect(r.value.backorderLines).toEqual([{ id: 'a', quantity: '2.000' }]);
    expect(r.value.cancelledQty).toBe('0.000');
  });

  it('cancels the remainder instead when no backorder is requested', () => {
    const r = planDeliveryValidation({ lines, delivered: { a: '3', b: '1' }, noBackorder: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.backorder).toBe(false);
    expect(r.value.backorderLines).toEqual([]);
    expect(r.value.cancelledQty).toBe('3.500');
  });

  it('keeps a backorder for every line that is short, with thousandths', () => {
    const r = planDeliveryValidation({ lines, delivered: { a: '5', b: '1.25' }, noBackorder: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.backorderLines).toEqual([{ id: 'b', quantity: '1.250' }]);
  });

  it('refuses more than the ordered quantity', () => {
    const r = planDeliveryValidation({ lines, delivered: { a: '6' }, noBackorder: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.details?.reason).toBe(DELIVERY_QTY_OVER);
  });

  it('refuses negative or malformed quantities', () => {
    for (const bad of ['-1', 'abc', '1.2345']) {
      const r = planDeliveryValidation({ lines, delivered: { a: bad }, noBackorder: false });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.details?.reason).toBe(DELIVERY_QTY_INVALID);
    }
  });

  it('refuses a delivery where nothing is handed over', () => {
    const r = planDeliveryValidation({ lines, delivered: { a: '0', b: '0' }, noBackorder: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.details?.reason).toBe(DELIVERY_NOTHING_DELIVERED);
  });

  it('accepts a Map of delivered quantities', () => {
    const r = planDeliveryValidation({ lines, delivered: new Map([['a', '3']]), noBackorder: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.backorderLines).toEqual([{ id: 'a', quantity: '2.000' }]);
  });
});
