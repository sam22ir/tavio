import type { DocumentLabels } from './document-layout';
import type { TicketLabels } from './ticket-layout';

/** Translator for the shared `print` namespace (messages/<locale>/print.json). */
export type PrintTranslator = (key: string) => string;

const DOC_KEYS = [
  'seller', 'buyer', 'nif', 'nis', 'rc', 'ai', 'address', 'phone', 'email', 'wilaya', 'number', 'date', 'dueDate',
  'description', 'qty', 'unit', 'discount', 'vatRate', 'vat', 'base', 'stampDuty', 'totalHt', 'totalTtc',
  'totalInWords', 'paid', 'balance', 'page', 'legal', 'verify',
] as const;

export function documentLabels(t: PrintTranslator): DocumentLabels {
  return Object.fromEntries(DOC_KEYS.map((k) => [k, t(k)])) as DocumentLabels;
}

export function ticketLabels(t: PrintTranslator): TicketLabels {
  return {
    ticket: t('ticket'),
    ticketNumber: t('ticketNumber'),
    total: t('total'),
    vat: t('vat'),
    base: t('base'),
    totalInWords: t('totalInWords'),
    payWith: t('payWith'),
    change: t('change'),
    nif: t('nif'),
    rc: t('rc'),
  };
}
