import type { Tint } from '@/ui/blocks/tint';

const SUCCESS = new Set(['active', 'paid', 'posted', 'confirmed', 'received', 'delivered', 'done', 'won', 'completed', 'resolved', 'validated', 'approved', 'sent', 'reconciled', 'closed']);
const WARNING = new Set(['partial', 'partially_paid', 'pending', 'waiting', 'open', 'in_progress', 'scheduled', 'on_hold', 'unpaid', 'due']);
const DANGER = new Set(['overdue', 'late', 'cancelled', 'canceled', 'failed', 'lost', 'void', 'voided', 'rejected', 'defaulted', 'blocked', 'unmatched']);
const INFO = new Set(['new', 'qualified', 'proposal', 'ordered', 'quote', 'sent_to_customer', 'negotiation']);

/** True for entity fields that hold a lifecycle status, which are shown as chips in lists. */
export function isStatusField(name: string): boolean {
  return /^(status|state|stage)$/i.test(name) || /(Status|State)$/.test(name);
}

/** Tint for a status value. Unknown values (draft, archived, ...) stay neutral. */
export function toneForStatus(value: string): Tint {
  const v = value.trim().toLowerCase();
  if (SUCCESS.has(v)) return 'success';
  if (DANGER.has(v)) return 'danger';
  if (WARNING.has(v)) return 'warning';
  if (INFO.has(v)) return 'info';
  return 'neutral';
}
