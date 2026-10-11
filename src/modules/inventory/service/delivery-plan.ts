import { err, ok, type Result } from '@/core/result';
import { fromMilli, toMilli } from './quantity';

/** Reason codes in `error.details.reason`, mapped by the UI to `inventory.errors.<reason>`. */
export const DELIVERY_QTY_INVALID = 'delivery_qty_invalid';
export const DELIVERY_QTY_OVER = 'delivery_qty_over';
export const DELIVERY_NOTHING_DELIVERED = 'delivery_nothing_delivered';

export interface PlannedDeliveryLine {
  id: string;
  /** Quantity demanded on the delivery (unchanged by validation). */
  quantity: string;
  /** Quantity handed over now. */
  deliveredQty: string;
  /** Quantity left over: a backorder when `backorder` is true, cancelled when not. */
  remainder: string;
}

export interface DeliveryPlan {
  lines: PlannedDeliveryLine[];
  /** Lines with something left over, for the backorder (empty when none or cancelled). */
  backorderLines: { id: string; quantity: string }[];
  /** True when a backorder must be created. */
  backorder: boolean;
  /** Total left over and cancelled, per line, when the user ticked "no backorder". */
  cancelledQty: string;
}

/**
 * Pure rule for validating a delivery. `delivered` maps line id to the quantity handed over; a line
 * missing from the map is delivered in full (the default). Each quantity must be a non-negative decimal
 * no larger than the line quantity, and something must be delivered. Whatever is left over becomes a
 * backorder, unless `noBackorder` is set, in which case it is cancelled.
 */
export function planDeliveryValidation(input: {
  lines: readonly { id: string; quantity: string }[];
  delivered: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  noBackorder: boolean;
}): Result<DeliveryPlan> {
  const lookup = (id: string): string | undefined =>
    input.delivered instanceof Map ? input.delivered.get(id) : (input.delivered as Record<string, string>)[id];

  const planned: { line: PlannedDeliveryLine; remainderMilli: bigint }[] = [];
  let deliveredTotal = 0n;
  let cancelled = 0n;
  for (const line of input.lines) {
    const qty = toMilli(line.quantity);
    if (qty === null || qty <= 0n) return err('VALIDATION', 'line quantity invalid', { reason: DELIVERY_QTY_INVALID });
    const raw = lookup(line.id);
    const deliveredMilli = raw === undefined ? qty : toMilli(raw);
    if (deliveredMilli === null || deliveredMilli < 0n) {
      return err('VALIDATION', 'delivered quantity invalid', { reason: DELIVERY_QTY_INVALID, lineId: line.id });
    }
    if (deliveredMilli > qty) {
      return err('VALIDATION', 'delivered quantity above ordered quantity', { reason: DELIVERY_QTY_OVER, lineId: line.id });
    }
    const remainder = qty - deliveredMilli;
    deliveredTotal += deliveredMilli;
    if (input.noBackorder) cancelled += remainder;
    planned.push({
      line: {
        id: line.id,
        quantity: fromMilli(qty),
        deliveredQty: fromMilli(deliveredMilli),
        remainder: fromMilli(remainder),
      },
      remainderMilli: remainder,
    });
  }
  if (deliveredTotal === 0n) return err('VALIDATION', 'nothing delivered', { reason: DELIVERY_NOTHING_DELIVERED });

  const left = planned.filter((p) => p.remainderMilli > 0n).map((p) => p.line);
  const backorder = left.length > 0 && !input.noBackorder;
  return ok({
    lines: planned.map((p) => p.line),
    backorderLines: backorder ? left.map((p) => ({ id: p.id, quantity: p.remainder })) : [],
    backorder,
    cancelledQty: fromMilli(cancelled),
  });
}
