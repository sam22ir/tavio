// Plain constants shared by server and client code. No Node or DB imports here.
import type { EventName } from '@/core/events/catalog';

export const CUSTOM_ENTITIES = ['contacts.partner'] as const;
export type CustomEntity = (typeof CUSTOM_ENTITIES)[number];

export const CUSTOM_FIELD_TYPES = ['text', 'number', 'date', 'boolean', 'select'] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const API_SCOPES = ['contacts:read', 'products:read', 'products:write', 'invoices:read'] as const;
export type ApiScope = (typeof API_SCOPES)[number];

/** Events a webhook may subscribe to. Must match names in core/events/catalog.ts. */
export const WEBHOOK_EVENTS = [
  'sales.order.confirmed',
  'invoicing.invoice.posted',
  'invoicing.payment.registered',
  'purchases.order.received',
  'pos.order.paid',
  'inventory.move.done',
  'credit_sales.payment.recorded',
] as const satisfies readonly EventName[];
