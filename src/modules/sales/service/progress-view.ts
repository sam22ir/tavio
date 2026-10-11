// Labels and badge tones for the sale order progress badges. Keys live in sales.progress.*.
import type { DeliveryStatus, InvoiceStatus } from './progress';

export const DELIVERY_BADGE: Record<DeliveryStatus, { key: string; tone: 'warn' | 'info' | 'ok' }> = {
  to_deliver: { key: 'progress.delivery.to_deliver', tone: 'warn' },
  partial: { key: 'progress.delivery.partial', tone: 'info' },
  delivered: { key: 'progress.delivery.delivered', tone: 'ok' },
};

export const INVOICE_BADGE: Record<InvoiceStatus, { key: string; tone: 'warn' | 'info' | 'ok' }> = {
  to_invoice: { key: 'progress.invoice.to_invoice', tone: 'warn' },
  partial: { key: 'progress.invoice.partial', tone: 'info' },
  invoiced: { key: 'progress.invoice.invoiced', tone: 'ok' },
};
