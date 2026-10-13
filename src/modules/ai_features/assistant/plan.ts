import { z } from 'zod';
import { parseJsonReply } from '@/core/adapters/ai';
import { ACTION_KINDS, parseProposals, type ActionKind, type Proposal } from '../actions/rules';

/** Read-only tools the assistant may call. Adding a name is a deliberate code change. */
export const ASSISTANT_TOOL_NAMES = [
  'kpis',
  'overdue',
  'top_customers_month',
  'low_stock',
  'unpaid_invoices',
  'collections_queue',
] as const;
export type AssistantToolName = (typeof ASSISTANT_TOOL_NAMES)[number];

const planSchema = z.object({ tools: z.array(z.string()).max(10) });

/** Keeps only whitelisted tool names, de-duplicated. Unknown names are dropped, never run. */
export function planToolCalls(replyText: string, allowed: readonly string[] = ASSISTANT_TOOL_NAMES): AssistantToolName[] {
  const raw = parseJsonReply<unknown>(replyText);
  const parsed = planSchema.safeParse(raw);
  if (!parsed.success) return [];
  const allow = new Set<string>(allowed);
  const picked = new Set<AssistantToolName>();
  for (const name of parsed.data.tools) {
    if (allow.has(name)) picked.add(name as AssistantToolName);
  }
  return [...picked];
}

/**
 * Action kinds the planner asked for, from {"actions": ["reminder_batch"]} or {"actions": [{"kind": "reminder_batch"}]}.
 * Only whitelisted kinds survive. The kinds gate a second AI call that proposes the real IDs after the tools ran.
 */
export function planActionKinds(replyText: string, allowed: readonly string[] = ACTION_KINDS): ActionKind[] {
  const raw = parseJsonReply<unknown>(replyText);
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { actions?: unknown }).actions)) return [];
  const allow = new Set<string>(allowed);
  const picked = new Set<ActionKind>();
  for (const item of (raw as { actions: unknown[] }).actions.slice(0, 10)) {
    const name = typeof item === 'string' ? item : (item as { kind?: unknown } | null)?.kind;
    if (typeof name === 'string' && allow.has(name)) picked.add(name as ActionKind);
  }
  return [...picked];
}

/**
 * Parses the reply that proposes actions. Shape: {"actions": [...]}. Items must use whitelisted kinds, at most
 * 10 contract IDs, and only IDs in `allowedIds` (the IDs of this request's tool results). Anything else is dropped.
 */
export function planActionProposals(replyText: string, allowedIds: ReadonlySet<string>): Proposal[] {
  const raw = parseJsonReply<unknown>(replyText);
  if (!raw || typeof raw !== 'object') return [];
  return parseProposals((raw as { actions?: unknown }).actions, allowedIds);
}

export const TOOL_DESCRIPTIONS: Record<AssistantToolName, string> = {
  kpis: "today's dashboard KPIs: due today, overdue amount and count, collected this month, active contracts, open leads",
  overdue: 'overdue credit installments with partner and days late',
  top_customers_month: 'top 5 customers by posted sales invoice total this month',
  low_stock: 'products at or below their reorder level',
  unpaid_invoices: 'unpaid and partly paid posted sales invoices, total outstanding and count',
  collections_queue: 'overdue customers ranked by days late then amount, with their latest risk grade (A to D, or new when unscored)',
};
