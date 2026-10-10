// Stock valuation at weighted average cost (CMUP, coût moyen unitaire pondéré).
// Pure functions only: no DB access, so they are unit tested directly.
//
// Scope: the average is kept per product per company, across all warehouses. Products are
// company-scoped (products.company_id), so the average lives on products.avg_cost_cents.
// Quantities are bigint thousandths (see ./quantity.ts). Money is bigint cents.
import type { StockMoveKind } from '@/core/events/catalog';

export type LocationType = 'internal' | 'customer' | 'supplier' | 'inventory_loss';

export interface AverageState {
  /** On hand before the move, in thousandths, summed over all internal locations. */
  onHandMilli: bigint;
  /** Current average unit cost in cents. */
  avgCostCents: bigint;
}

export type ValuedMove =
  | { direction: 'in'; unitCostCents: bigint }
  | { direction: 'out' };

export interface ValuationResult {
  unitCostCents: bigint;
  valueCents: bigint;
  avgCostCents: bigint;
}

/** Integer division rounded half-up (away from zero on ties). Denominator must be positive. */
export function roundDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError('roundDiv: denominator must be positive');
  if (numerator < 0n) return -roundDiv(-numerator, denominator);
  return (2n * numerator + denominator) / (2n * denominator);
}

/**
 * Next weighted average after one move, and the cost the move is booked at.
 *
 * - Outgoing (delivery, loss, transfer): the unit cost is the current average; the average is unchanged.
 * - Incoming (receipt, return, gain): new average = (on_hand x avg + qty x unit) / (on_hand + qty),
 *   rounded to the cent. When on hand is zero or negative, the average resets to the incoming unit cost,
 *   so stale cost or oversold stock does not distort later receipts.
 *
 * `qtyMilli` must be positive. The caller resolves the incoming unit cost (purchase price, original
 * delivery cost for returns, or the current average as a fallback).
 */
export function nextAverageCost(state: AverageState, qtyMilli: bigint, move: ValuedMove): ValuationResult {
  if (qtyMilli <= 0n) throw new RangeError('nextAverageCost: quantity must be positive');
  if (move.direction === 'out') {
    const unit = state.avgCostCents;
    return {
      unitCostCents: unit,
      valueCents: roundDiv(qtyMilli * unit, 1000n),
      avgCostCents: state.avgCostCents,
    };
  }
  const unit = move.unitCostCents;
  const valueCents = roundDiv(qtyMilli * unit, 1000n);
  if (state.onHandMilli <= 0n) {
    return { unitCostCents: unit, valueCents, avgCostCents: unit };
  }
  const avg = roundDiv(state.onHandMilli * state.avgCostCents + qtyMilli * unit, state.onHandMilli + qtyMilli);
  return { unitCostCents: unit, valueCents, avgCostCents: avg };
}

/** Kind of a move from its locations. Null for combinations that carry no accounting meaning. */
export function classifyStockMove(from: LocationType, to: LocationType): StockMoveKind | null {
  if (from === 'internal' && to === 'internal') return 'transfer';
  if (from === 'supplier' && to === 'internal') return 'receipt';
  if (from === 'customer' && to === 'internal') return 'return';
  if (from === 'internal' && to === 'customer') return 'delivery';
  if (from === 'internal' && to === 'inventory_loss') return 'loss';
  if (from === 'inventory_loss' && to === 'internal') return 'gain';
  return null;
}

/** Incoming kinds raise stock at a cost. Everything else leaves stock at the current average. */
export function isIncomingKind(kind: StockMoveKind): boolean {
  return kind === 'receipt' || kind === 'return' || kind === 'gain';
}
