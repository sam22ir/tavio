// Cross-module event payloads (P4–P8). Modules communicate through these events only.
// Amounts are bigint cents serialised as strings; quantities are decimal strings.
export interface QtyLine {
  productId: string | null;
  quantity: string;
  /** Unit cost in cents, excluding VAT. Set on purchase receipts (PO line unit price). */
  unitCostCents?: string;
}

export interface SalesOrderConfirmed {
  orderId: string;
  partnerId: string;
  number: string;
  /** Lines with their sale order line id, so the delivery can point back at them. */
  lines: (QtyLine & { saleOrderLineId: string })[];
}
export interface SalesOrderCancelled { orderId: string; number: string | null }
/** One validated delivery of a sale order: per order line, what was handed over and what was dropped. */
export interface InventoryDeliveryValidated {
  deliveryId: string;
  sourceEntity: string | null;
  sourceId: string | null;
  lines: { saleOrderLineId: string; deliveredQty: string; cancelledQty: string }[];
}
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
  /** Retenue à la source on a vendor bill. Present only when > 0. ⚠ needs accountant verification */
  withholdingCents?: string;
  withholdingAccountCode?: string;
  taxLines: { taxId: string | null; ratePercent: string; baseCents: string; taxCents: string }[];
}
export interface InvoicePaymentRegistered {
  paymentId: string; invoiceId: string; type: InvoicePosted['type'];
  partnerId: string; amountCents: string; method: string; date: string;
  /** Timbre fiscal added to the invoice by this cash payment. Present only when > 0. ⚠ needs accountant verification */
  stampCents?: string;
}
export interface CreditPaymentRecorded { contractId: string; partnerId: string; paymentId: string; amountCents: string }
export interface CreditContractActivated {
  contractId: string; number: string; partnerId: string;
  cashPriceCents: string; markupCents: string; downPaymentCents: string; financedCents: string;
}
export interface PurchaseOrderReceived { orderId: string; number: string; lines: QtyLine[] }
export interface PosOrderPaid {
  orderId: string; sessionId: string; number: string; method: string;
  totalCents: string; untaxedCents: string; taxCents: string; lines: QtyLine[];
}
/** Classification of a validated stock move, derived from its locations. Transfers have no accounting effect. */
export type StockMoveKind = 'receipt' | 'delivery' | 'return' | 'loss' | 'gain' | 'transfer';
/** A done stock move with its valuation (CMUP). valueCents = quantity x unit cost, rounded to the cent. */
export interface InventoryMovePosted {
  moveId: string; reference: string; productId: string; kind: StockMoveKind;
  quantity: string; unitCostCents: string; valueCents: string; date: string; // YYYY-MM-DD (Africa/Algiers)
}
export interface StockMoveDone { moveId: string; productId: string; quantity: string; fromLocationId: string; toLocationId: string }
export interface CrmLeadCreated { leadId: string; stageId: string; userId: string | null; teamId: string | null }
export interface CrmLeadStageChanged { leadId: string; fromStageId: string; toStageId: string; userId: string | null }
export interface CrmLeadWon { leadId: string }
export interface CrmLeadLost { leadId: string; lostReasonId: string }
export interface ChatterActivityDone {
  activityId: string; entity: string; recordId: string;
  activityTypeId: string | null; result: string | null;
}
export interface CreditContractStateChanged {
  contractId: string; partnerId: string; fromState: string; toState: string;
}

export interface EventCatalog {
  'sales.order.confirmed': SalesOrderConfirmed;
  'sales.order.cancelled': SalesOrderCancelled;
  'inventory.delivery.validated': InventoryDeliveryValidated;
  'invoicing.invoice.posted': InvoicePosted;
  'invoicing.payment.registered': InvoicePaymentRegistered;
  'purchases.order.received': PurchaseOrderReceived;
  'pos.order.paid': PosOrderPaid;
  'inventory.move.done': StockMoveDone;
  'inventory.move.posted': InventoryMovePosted;
  'credit_sales.payment.recorded': CreditPaymentRecorded;
  'credit_sales.contract.activated': CreditContractActivated;
  'crm.lead.created': CrmLeadCreated;
  'crm.lead.stage_changed': CrmLeadStageChanged;
  'crm.lead.won': CrmLeadWon;
  'crm.lead.lost': CrmLeadLost;
  'chatter.activity.done': ChatterActivityDone;
  'credit_sales.contract.state_changed': CreditContractStateChanged;
}
export type EventName = keyof EventCatalog;

/** Runtime list of every event name. The type check fails to compile when an event is missing here. */
export const EVENT_NAMES = [
  'sales.order.confirmed',
  'sales.order.cancelled',
  'inventory.delivery.validated',
  'invoicing.invoice.posted',
  'invoicing.payment.registered',
  'purchases.order.received',
  'pos.order.paid',
  'inventory.move.done',
  'inventory.move.posted',
  'credit_sales.payment.recorded',
  'credit_sales.contract.activated',
  'crm.lead.created',
  'crm.lead.stage_changed',
  'crm.lead.won',
  'crm.lead.lost',
  'chatter.activity.done',
  'credit_sales.contract.state_changed',
] as const satisfies readonly EventName[];

type UnlistedEvent = Exclude<EventName, (typeof EVENT_NAMES)[number]>;
export const ALL_EVENTS_LISTED: [UnlistedEvent] extends [never] ? true : UnlistedEvent = true;
