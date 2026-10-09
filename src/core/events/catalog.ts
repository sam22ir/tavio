// Cross-module event payloads (P4–P8). Modules communicate through these events only.
// Amounts are bigint cents serialised as strings; quantities are decimal strings.
export interface QtyLine { productId: string | null; quantity: string }

export interface SalesOrderConfirmed { orderId: string; partnerId: string; number: string; lines: QtyLine[] }
export interface InvoicePosted {
  invoiceId: string;
  type: 'out_invoice' | 'out_refund' | 'in_invoice' | 'in_refund';
  partnerId: string;
  number: string;
  date: string;                  // YYYY-MM-DD
  untaxedCents: string;
  taxCents: string;
  stampCents: string;
  totalCents: string;
  taxLines: { taxId: string | null; ratePercent: string; baseCents: string; taxCents: string }[];
}
export interface InvoicePaymentRegistered {
  paymentId: string; invoiceId: string; type: InvoicePosted['type'];
  partnerId: string; amountCents: string; method: string; date: string;
}
export interface PurchaseOrderReceived { orderId: string; number: string; lines: QtyLine[] }
export interface PosOrderPaid {
  orderId: string; sessionId: string; number: string; method: string;
  totalCents: string; untaxedCents: string; taxCents: string; lines: QtyLine[];
}
export interface StockMoveDone { moveId: string; productId: string; quantity: string; fromLocationId: string; toLocationId: string }

export interface EventCatalog {
  'sales.order.confirmed': SalesOrderConfirmed;
  'invoicing.invoice.posted': InvoicePosted;
  'invoicing.payment.registered': InvoicePaymentRegistered;
  'purchases.order.received': PurchaseOrderReceived;
  'pos.order.paid': PosOrderPaid;
  'inventory.move.done': StockMoveDone;
  'credit_sales.payment.recorded': { contractId: string; partnerId: string; paymentId: string; amountCents: string };
}
export type EventName = keyof EventCatalog;

/** Runtime list of every event name. The type check fails to compile when an event is missing here. */
export const EVENT_NAMES = [
  'sales.order.confirmed',
  'invoicing.invoice.posted',
  'invoicing.payment.registered',
  'purchases.order.received',
  'pos.order.paid',
  'inventory.move.done',
  'credit_sales.payment.recorded',
] as const satisfies readonly EventName[];

type UnlistedEvent = Exclude<EventName, (typeof EVENT_NAMES)[number]>;
export const ALL_EVENTS_LISTED: [UnlistedEvent] extends [never] ? true : UnlistedEvent = true;
