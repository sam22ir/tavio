import { and, eq } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import type { DomainEvent } from '@/core/events';
import { outbox } from '@/core/db/schema';
import type { EventName } from '@/core/events/catalog';
import { ensureActivity, postMessage, todayIso } from '@/modules/chatter/service';
import { actionConfigSchemas, type ActionName } from './config';
import { conditionsSchema, matchesConditions, readPath } from './conditions';
import { automationRules } from './schema';

// Events a rule may listen to. Must match src/core/events/catalog.ts.
export const TRIGGER_EVENTS = [
  'sales.order.confirmed',
  'invoicing.invoice.posted',
  'invoicing.payment.registered',
  'purchases.order.received',
  'pos.order.paid',
  'inventory.move.done',
  'credit_sales.payment.recorded',
] as const satisfies readonly EventName[];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Replaces {path} placeholders with payload values. Missing values become empty strings. */
export function renderTemplate(template: string, payload: unknown): string {
  return template.replace(/\{([A-Za-z0-9_.]+)\}/g, (_m, path: string) => {
    const v = readPath(payload, path);
    return v === undefined || v === null || typeof v === 'object' ? '' : String(v);
  });
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function runAction(
  ctx: Ctx,
  event: DomainEvent,
  action: ActionName,
  rawConfig: unknown,
): Promise<boolean> {
  const parsed = actionConfigSchemas[action].safeParse(rawConfig);
  if (!parsed.success) return false;
  const config = parsed.data as Record<string, unknown>;

  if (action === 'webhook') {
    await ctx.tx.insert(outbox).values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      eventType: 'automation.webhook',
      payload: { url: config.url, event: event.name, data: event.payload } as object,
      status: 'pending',
    });
    return true;
  }

  const recordId = readPath(event.payload, String(config.recordIdField));
  // Skip silently when the payload has no record id, so one bad rule cannot block the business transaction.
  if (typeof recordId !== 'string' || !UUID_RE.test(recordId)) return false;
  const entity = String(config.entity);

  if (action === 'post_note') {
    const res = await postMessage(ctx, {
      entity,
      recordId,
      body: renderTemplate(String(config.body), event.payload),
      kind: 'note',
    });
    return res.ok;
  }

  const res = await ensureActivity(ctx, {
    entity,
    recordId,
    typeKey: String(config.typeKey),
    summary: renderTemplate(String(config.summary), event.payload),
    dueDate: addDays(todayIso(), Number(config.dueInDays)),
  });
  return res.ok;
}

/**
 * Runs every active rule for this event whose conditions match. Call after each emit, inside ctx.tx.
 * Returns how many actions ran. Failed actions are skipped, not thrown, so the business transaction survives.
 */
export async function runAutomations(ctx: Ctx, event: DomainEvent): Promise<number> {
  const rules = await ctx.tx
    .select()
    .from(automationRules)
    .where(
      and(
        eq(automationRules.companyId, ctx.companyId),
        eq(automationRules.active, true),
        eq(automationRules.triggerEvent, event.name),
      ),
    );

  let ran = 0;
  for (const rule of rules) {
    const conditions = conditionsSchema.safeParse(rule.conditions);
    if (!conditions.success || !matchesConditions(event.payload, conditions.data)) continue;
    if (!(rule.action in actionConfigSchemas)) continue;
    if (await runAction(ctx, event, rule.action as ActionName, rule.actionConfig)) ran += 1;
  }
  return ran;
}
