import { z } from 'zod';
import { parseJsonReply } from '@/core/adapters/ai';

/** Read-only tools the assistant may call. Adding a name is a deliberate code change. */
export const ASSISTANT_TOOL_NAMES = ['kpis', 'overdue', 'top_customers_month', 'low_stock', 'unpaid_invoices'] as const;
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

export const TOOL_DESCRIPTIONS: Record<AssistantToolName, string> = {
  kpis: "today's dashboard KPIs: due today, overdue amount and count, collected this month, active contracts, open leads",
  overdue: 'overdue credit installments with partner and days late',
  top_customers_month: 'top 5 customers by posted sales invoice total this month',
  low_stock: 'products at or below their reorder level',
  unpaid_invoices: 'unpaid and partly paid posted sales invoices, total outstanding and count',
};
