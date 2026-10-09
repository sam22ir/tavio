import { describe, expect, it } from 'vitest';
import { canBill, canCancel, canConfirm, canEdit, canReceive } from '../service/state';

describe('purchase order state machine', () => {
  it('only drafts are editable', () => {
    expect(canEdit('draft')).toBe(true);
    expect(canEdit('confirmed')).toBe(false);
    expect(canEdit('cancelled')).toBe(false);
  });

  it('confirms drafts and sent orders only', () => {
    expect(canConfirm('draft')).toBe(true);
    expect(canConfirm('sent')).toBe(true);
    expect(canConfirm('confirmed')).toBe(false);
    expect(canConfirm('received')).toBe(false);
  });

  it('receives only confirmed orders', () => {
    expect(canReceive('confirmed')).toBe(true);
    expect(canReceive('draft')).toBe(false);
    expect(canReceive('received')).toBe(false);
  });

  it('cancels before any receipt only', () => {
    expect(canCancel('draft', false)).toBe(true);
    expect(canCancel('confirmed', false)).toBe(true);
    expect(canCancel('confirmed', true)).toBe(false);
    expect(canCancel('cancelled', false)).toBe(false);
  });

  it('bills confirmed or received orders once', () => {
    expect(canBill('confirmed', false)).toBe(true);
    expect(canBill('received', false)).toBe(true);
    expect(canBill('received', true)).toBe(false);
    expect(canBill('draft', false)).toBe(false);
  });
});
