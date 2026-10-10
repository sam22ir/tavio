// Pure state machine for purchase orders. Services call these before mutating.
import type { PURCHASE_ORDER_STATES } from '../schema';
import { unbilledQty } from './math';

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

/** Billing is allowed on confirmed or received orders while any line has received quantity not yet billed. */
export function isBillableState(state: string): boolean {
  return state === 'confirmed' || state === 'received';
}

export function canBill(state: string, lines: readonly { receivedQty: string; billedQty: string }[]): boolean {
  return isBillableState(state) && lines.some((l) => unbilledQty(l.receivedQty, l.billedQty) > BigInt(0));
}
