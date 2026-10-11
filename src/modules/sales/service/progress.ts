// Delivery and invoicing progress of a sale order, derived from its lines. Quantities are decimal strings,
// computed in thousandths so no float error creeps in.

export type InvoicePolicy = 'order' | 'delivery';
export type DeliveryStatus = 'to_deliver' | 'partial' | 'delivered';
export type InvoiceStatus = 'to_invoice' | 'partial' | 'invoiced';

export interface ProgressLine {
  quantity: string;
  deliveredQty: string;
  cancelledQty: string;
  invoicedQty: string;
  policy: InvoicePolicy;
}

const QTY_RE = /^\d{1,11}(\.\d{1,3})?$/;

/** Decimal quantity to thousandths. Malformed or negative input reads as 0. */
export function qtyMilli(raw: string): bigint {
  const v = raw.trim();
  if (!QTY_RE.test(v)) return 0n;
  const [whole = '0', frac = ''] = v.split('.');
  return BigInt(whole) * 1000n + BigInt(frac.padEnd(3, '0'));
}

/** Thousandths back to a numeric(14,3) string. */
export function qtyFromMilli(milli: bigint): string {
  const m = milli < 0n ? 0n : milli;
  return `${m / 1000n}.${(m % 1000n).toString().padStart(3, '0')}`;
}

/**
 * Quantity to bill on this line now. Policy 'order' bills the ordered quantity less what was dropped and
 * already billed. Policy 'delivery' bills what was delivered less what was already billed. Never negative.
 */
export function billableQuantity(line: ProgressLine): string {
  const target =
    line.policy === 'order'
      ? qtyMilli(line.quantity) - qtyMilli(line.cancelledQty)
      : qtyMilli(line.deliveredQty);
  return qtyFromMilli(target - qtyMilli(line.invoicedQty));
}

/** Quantity the order owes in total under the line's policy (what a full invoice would bill). */
function invoiceTarget(line: ProgressLine): bigint {
  return line.policy === 'order'
    ? qtyMilli(line.quantity) - qtyMilli(line.cancelledQty)
    : qtyMilli(line.deliveredQty);
}

export interface OrderProgress {
  deliveryStatus: DeliveryStatus;
  invoiceStatus: InvoiceStatus;
  /** Every line is delivered or dropped. */
  fullyDelivered: boolean;
  /** Every line is billed up to its policy target, and something is billable at all. */
  fullyInvoiced: boolean;
  /** The order is done: fully delivered and fully invoiced. */
  done: boolean;
}

export function orderProgress(lines: readonly ProgressLine[]): OrderProgress {
  const fullyDelivered = lines.every(
    (l) => qtyMilli(l.deliveredQty) + qtyMilli(l.cancelledQty) >= qtyMilli(l.quantity),
  );
  const anyDelivered = lines.some((l) => qtyMilli(l.deliveredQty) > 0n);
  const deliveryStatus: DeliveryStatus = fullyDelivered ? 'delivered' : anyDelivered ? 'partial' : 'to_deliver';

  const targetTotal = lines.reduce((sum, l) => sum + invoiceTarget(l), 0n);
  const invoicedTotal = lines.reduce((sum, l) => sum + qtyMilli(l.invoicedQty), 0n);
  const fullyInvoiced =
    targetTotal > 0n && lines.every((l) => qtyMilli(l.invoicedQty) >= invoiceTarget(l));
  const invoiceStatus: InvoiceStatus = fullyInvoiced ? 'invoiced' : invoicedTotal > 0n ? 'partial' : 'to_invoice';

  return {
    deliveryStatus,
    invoiceStatus,
    fullyDelivered,
    fullyInvoiced,
    done: fullyDelivered && fullyInvoiced,
  };
}
