import { z } from 'zod';

// Whitelists for automation writes. Only these columns can be changed by update_record, and time rules
// can only compare these date columns. State columns are never listed: state changes go through
// the module's transition services (credit contracts) or the lead services (lost, won).

export const TIME_ENTITIES = ['lead', 'activity', 'credit_contract'] as const;
export type TimeEntity = (typeof TIME_ENTITIES)[number];

export const UPDATE_ENTITIES = ['lead', 'credit_contract'] as const;
export type UpdateEntity = (typeof UPDATE_ENTITIES)[number];

/** Table and chatter entity name for each record type automation can reach. */
export const RECORD_ENTITIES = {
  lead: { table: 'leads', chatterEntity: 'crm.lead' },
  activity: { table: 'activities', chatterEntity: 'chatter.activity' },
  credit_contract: { table: 'contracts', chatterEntity: 'credit_sales.contract' },
} as const satisfies Record<TimeEntity, { table: string; chatterEntity: string }>;

export const TIME_DATE_FIELDS: Record<TimeEntity, readonly string[]> = {
  lead: ['created_at', 'stage_entered_at', 'expected_close_date'],
  activity: ['due_date'],
  credit_contract: [
    'start_date',
    'confirmed_at',
    'sent_to_bo_at',
    'received_by_bo_at',
    'decided_at',
    'central_risk_checked_at',
    'bank_notified_at',
  ],
};

export interface UpdatableField {
  /** Value shape: a regex the value must match, or a fixed list. */
  pattern?: RegExp;
  allowed?: readonly string[];
  /** Values the rule may never write (terminal states that have their own services). */
  refused?: readonly string[];
  maxLength: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const UPDATABLE_FIELDS: Record<UpdateEntity, Record<string, UpdatableField>> = {
  lead: {
    channel: { allowed: ['phone', 'whatsapp', 'showroom', 'web', 'referral', 'other'], maxLength: 20 },
    expected_close_date: { pattern: /^\d{4}-\d{2}-\d{2}$/, maxLength: 10 },
    probability: { pattern: /^(100|[0-9]{1,2})$/, maxLength: 3 },
    // Lost and won leads change only through the CRM services, which record the reason and emit events.
    status: { pattern: /^[a-z_]{1,40}$/, refused: ['lost', 'won'], maxLength: 40 },
  },
  credit_contract: {
    bo_owner_id: { pattern: UUID, maxLength: 36 },
    decision_reason: { maxLength: 500 },
    next_action: { maxLength: 200 },
    bank_name: { maxLength: 120 },
    bank_reference: { maxLength: 120 },
    central_risk_result: { allowed: ['clear', 'flagged'], maxLength: 10 },
  },
};

/** Returns an error message when a value is not allowed for the field, otherwise null. */
export function checkUpdateValue(entity: UpdateEntity, field: string, value: string): string | null {
  const spec = UPDATABLE_FIELDS[entity][field];
  if (!spec) return `Field ${field} cannot be updated by automation`;
  if (value.length > spec.maxLength) return `Value too long for ${field}`;
  if (spec.refused?.includes(value)) return `Automation cannot set ${field} to ${value}`;
  if (spec.allowed && !spec.allowed.includes(value)) return `Invalid value for ${field}`;
  if (spec.pattern && !spec.pattern.test(value)) return `Invalid value for ${field}`;
  return null;
}

export const timeConfigSchema = z
  .object({
    entity: z.enum(TIME_ENTITIES),
    dateField: z.string().min(1).max(60),
    delayDays: z.number().int().min(0).max(3650),
  })
  .superRefine((cfg, c) => {
    if (!TIME_DATE_FIELDS[cfg.entity].includes(cfg.dateField)) {
      c.addIssue({ code: 'custom', path: ['dateField'], message: 'Date field is not allowed for this record type' });
    }
  });
export type TimeConfig = z.infer<typeof timeConfigSchema>;
