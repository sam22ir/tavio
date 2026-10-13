import { z } from 'zod';

/*
 * Pure rules for confirmable AI actions. No DB or AI imports, so they can be unit tested.
 * The model may only name a kind and IDs that appeared in tool results. Everything else is computed here or in service.ts.
 */

export const ACTION_KINDS = ['reminder_batch', 'draft_invoice'] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

export const ACTION_PERM = 'ai_features.assistant.use';
/** Each kind also needs the permission of the domain it writes to, checked on propose and again on confirm. */
export const DOMAIN_PERM: Record<ActionKind, string> = {
  reminder_batch: 'credit_sales.contract.read',
  draft_invoice: 'invoicing.invoice.write',
};

export const REMINDER_BATCH_MAX = 10;
export const DRAFT_INVOICE_MAX_LINES = 20;

export type ReminderStage = 'polite' | 'firm' | 'final';
export const FIRM_AFTER_DAYS = 7;
export const FINAL_AFTER_DAYS = 14;
/** Minimum days between two prepared reminders for the same contract. */
export const MIN_GAP_DAYS = 3;

/**
 * Stage of the next reminder for a contract that is late, or null when nothing is due yet.
 * `history` holds the stages already prepared for the contract, oldest first.
 *  - never reminded: polite
 *  - last polite and at least FIRM_AFTER_DAYS late: firm, otherwise null (wait)
 *  - last firm and at least FINAL_AFTER_DAYS late: final, otherwise null (wait)
 *  - last final: null, the batch does not escalate further on its own
 */
export function nextReminderStage(
  daysLate: number,
  history: readonly ReminderStage[],
  daysSinceLast: number = Number.POSITIVE_INFINITY,
): ReminderStage | null {
  if (daysLate <= 0) return null;
  const last = history[history.length - 1];
  if (last === undefined) return 'polite';
  if (daysSinceLast < MIN_GAP_DAYS) return null;
  if (last === 'polite') return daysLate >= FIRM_AFTER_DAYS ? 'firm' : null;
  if (last === 'firm') return daysLate >= FINAL_AFTER_DAYS ? 'final' : null;
  return null;
}

const uuid = z.string().uuid();

/** Amounts come as decimal strings or integers. Bounds keep one line under about 10^10 DZD. */
export const invoiceLineSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.coerce
    .string()
    .trim()
    .regex(/^\d{1,7}(\.\d{1,3})?$/)
    .refine((q) => Number(q) > 0, 'quantity must be positive'),
  unitPriceCents: z.coerce
    .string()
    .trim()
    .regex(/^\d{1,12}$/),
});
export type InvoiceLineInput = z.infer<typeof invoiceLineSchema>;

const contractIdsSchema = z
  .array(uuid)
  .min(1)
  .max(REMINDER_BATCH_MAX)
  .refine((ids) => new Set(ids).size === ids.length, 'contract IDs must be unique');

export const reminderBatchPayloadSchema = z.object({
  contractIds: contractIdsSchema,
});
export const draftInvoicePayloadSchema = z.object({
  partnerId: uuid,
  lines: z.array(invoiceLineSchema).min(1).max(DRAFT_INVOICE_MAX_LINES),
});

/** A proposal as the planner returns it, validated. Kind is a discriminant, so unknown kinds fail. */
export const proposalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('reminder_batch'), contractIds: contractIdsSchema }),
  z.object({
    kind: z.literal('draft_invoice'),
    partnerId: draftInvoicePayloadSchema.shape.partnerId,
    lines: draftInvoicePayloadSchema.shape.lines,
  }),
]);
export type Proposal = z.infer<typeof proposalSchema>;

/** Splits a proposal into its stored payload (IDs and inputs only) and its kind. */
export function payloadOf(p: Proposal): Record<string, unknown> {
  if (p.kind === 'reminder_batch') return { contractIds: p.contractIds };
  return { partnerId: p.partnerId, lines: p.lines };
}

/** IDs a proposal refers to. They must all come from tool results in the same request. */
export function idsOf(p: Proposal): string[] {
  return p.kind === 'reminder_batch' ? p.contractIds : [p.partnerId];
}

/**
 * Keeps only valid proposals whose IDs are all in `allowedIds`. Unknown kinds, malformed items,
 * batches over the cap and invented IDs are dropped, never run.
 */
export function parseProposals(raw: unknown, allowedIds: ReadonlySet<string>): Proposal[] {
  if (!Array.isArray(raw)) return [];
  const out: Proposal[] = [];
  for (const item of raw.slice(0, 10)) {
    const parsed = proposalSchema.safeParse(item);
    if (!parsed.success) continue;
    if (!idsOf(parsed.data).every((id) => allowedIds.has(id))) continue;
    out.push(parsed.data);
  }
  return out;
}

export type StoredPayload =
  | { kind: 'reminder_batch'; contractIds: string[] }
  | { kind: 'draft_invoice'; partnerId: string; lines: InvoiceLineInput[] };

/** Validates a stored row's payload at confirm time. Returns null when it no longer matches the schema. */
export function parseStoredPayload(kind: string, payload: unknown): StoredPayload | null {
  if (kind === 'reminder_batch') {
    const p = reminderBatchPayloadSchema.safeParse(payload);
    return p.success ? { kind, contractIds: p.data.contractIds } : null;
  }
  if (kind === 'draft_invoice') {
    const p = draftInvoicePayloadSchema.safeParse(payload);
    return p.success ? { kind, partnerId: p.data.partnerId, lines: p.data.lines } : null;
  }
  return null;
}
