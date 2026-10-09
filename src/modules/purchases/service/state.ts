// Pure state machine for purchase orders. Services call these before mutating.
import type { PURCHASE_ORDER_STATES } from '../schema';

export type OrderState = (typeof PURCHASE_ORDER_STATES)[number];

export function canEdit(state: string): boolean {
  return state === 'draft';
}

export function canConfirm(state: string): boolean {
  return state === 'draft' || state === 'sent';
}

export function canReceive(state: string): boolean {
  return state === 'confirmed';
}

/** Cancel is allowed before any receipt. Received goods are never silently reversed. */
export function canCancel(state: string, anyReceived: boolean): boolean {
  return (state === 'draft' || state === 'sent' || state === 'confirmed') && !anyReceived;
}

export function canBill(state: string, billed: boolean): boolean {
  return (state === 'confirmed' || state === 'received') && !billed;
}
