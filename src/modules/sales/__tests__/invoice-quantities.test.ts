import { describe, expect, it } from 'vitest';
import { billableQuantity, orderProgress, qtyMilli, type ProgressLine } from '../service/progress';

const line = (over: Partial<ProgressLine>): ProgressLine => ({
  quantity: '5',
  deliveredQty: '0',
  cancelledQty: '0',
  invoicedQty: '0',
  policy: 'order',
  ...over,
});

describe('billableQuantity', () => {
  it('bills the ordered quantity under the order policy, ignoring delivery', () => {
    expect(billableQuantity(line({ policy: 'order' }))).toBe('5.000');
    expect(billableQuantity(line({ policy: 'order', deliveredQty: '3' }))).toBe('5.000');
  });

  it('bills the delivered quantity under the delivery policy', () => {
    expect(billableQuantity(line({ policy: 'delivery' }))).toBe('0.000');
    expect(billableQuantity(line({ policy: 'delivery', deliveredQty: '3' }))).toBe('3.000');
  });

  it('subtracts what was already invoiced', () => {
    expect(billableQuantity(line({ policy: 'delivery', deliveredQty: '3', invoicedQty: '1.5' }))).toBe('1.500');
    expect(billableQuantity(line({ policy: 'order', invoicedQty: '5' }))).toBe('0.000');
  });

  it('never bills a dropped remainder under the order policy', () => {
    expect(billableQuantity(line({ policy: 'order', cancelledQty: '2' }))).toBe('3.000');
  });

  it('never goes negative', () => {
    expect(billableQuantity(line({ policy: 'delivery', deliveredQty: '1', invoicedQty: '4' }))).toBe('0.000');
  });

  it('handles thousandths without float error', () => {
    expect(billableQuantity(line({ quantity: '0.300', deliveredQty: '0.100', policy: 'delivery' }))).toBe('0.100');
    expect(qtyMilli('12.5')).toBe(12500n);
  });
});

describe('orderProgress', () => {
  it('is to_deliver and to_invoice on a fresh order', () => {
    const p = orderProgress([line({})]);
    expect(p).toMatchObject({ deliveryStatus: 'to_deliver', invoiceStatus: 'to_invoice', done: false });
  });

  it('is partial after a partial delivery, and partially invoiced after billing the delivered part', () => {
    const p = orderProgress([line({ policy: 'delivery', deliveredQty: '3', invoicedQty: '3' })]);
    expect(p.deliveryStatus).toBe('partial');
    expect(p.invoiceStatus).toBe('invoiced');
    expect(p.done).toBe(false);
  });

  it('is done only when fully delivered and fully invoiced', () => {
    const lines = [line({ policy: 'delivery', quantity: '5', deliveredQty: '5', invoicedQty: '5' })];
    expect(orderProgress(lines).done).toBe(true);
    expect(orderProgress([line({ policy: 'delivery', quantity: '5', deliveredQty: '5', invoicedQty: '3' })]).done).toBe(false);
  });

  it('counts a dropped remainder as delivered for the order state', () => {
    const p = orderProgress([line({ policy: 'order', deliveredQty: '3', cancelledQty: '2', invoicedQty: '3' })]);
    expect(p.fullyDelivered).toBe(true);
    expect(p.done).toBe(true);
  });

  it('does not report invoiced for an order with nothing billable yet', () => {
    expect(orderProgress([line({ policy: 'delivery' })]).invoiceStatus).toBe('to_invoice');
  });
});
