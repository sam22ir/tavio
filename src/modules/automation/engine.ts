import { AsyncLocalStorage } from 'node:async_hooks';
import { and, eq, sql } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import type { DomainEvent } from '@/core/events';
import { outbox } from '@/core/db/schema';
import { assertMembers, ensureActivity, postMessage, todayIso } from '@/modules/chatter/service';
import { cancelPlanRuns, launchPlan } from '@/modules/chatter/service/plans';
import { actionConfigSchemas, type ActionName } from './config';
import { conditionsSchema, matchesConditions, readPath } from './conditions';
import { checkUpdateValue, RECORD_ENTITIES, UPDATABLE_FIELDS, type UpdateEntity } from './fields';
import { automationRules } from './schema';

// Every catalog event can trigger a rule. Time rules are handled by runTimedRules.
export { TRIGGER_EVENTS } from './config';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Automation actions can emit events (for example chatter.activity.done) that trigger other rules.
// The chain of rules currently running is carried through the async context, so a rule never
// re-enters itself and nested automation stops at MAX_CHAIN_DEPTH.
export const MAX_CHAIN_DEPTH = 3;
const runChain = new AsyncLocalStorage<readonly string[]>();

/** Whether a rule may run now: not already in the current chain and the chain is short enough. */
export function canRunRule(ruleId: string): boolean {
  const chain = runChain.getStore() ?? [];
  return !chain.includes(ruleId) && chain.length < MAX_CHAIN_DEPTH;
}

/** Runs fn with ruleId added to the current chain. Events emitted inside fn see the chain. */
export function runInRuleChain<T>(ruleId: string, fn: () => Promise<T>): Promise<T> {
  return runChain.run([...(runChain.getStore() ?? []), ruleId], fn);
}

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

/** Reads the record id from the payload. Returns null when it is missing or not a uuid. */
export function resolveRecordId(payload: unknown, field: string): string | null {
  const id = readPath(payload, field);
  return typeof id === 'string' && UUID_RE.test(id) ? id : null;
}

/**
 * Runs one action. Returns true when it took effect. Invalid configs and missing record ids return false
 * instead of throwing, so one bad rule cannot block the business transaction.
 */
export async function executeAction(
  ctx: Ctx,
  event: DomainEvent,
  action: ActionName,
  rawConfig: unknown,
  depth = 0,
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

  if (action === 'multi') {
    // Nested multi is refused by the schema, so depth only guards against a hand-edited row.
    if (depth > 0) return false;
    const steps = config.actions as { action: ActionName; config: unknown }[];
    let allOk = true;
    for (const step of steps) {
      const ok = await executeAction(ctx, event, step.action, step.config, depth + 1);
      allOk = allOk && ok;
    }
    return allOk;
  }

  const recordId = resolveRecordId(event.payload, String(config.recordIdField));
  if (!recordId) return false;

  if (action === 'update_record') {
    return updateRecord(ctx, recordId, config.entity as UpdateEntity, config.updates as Record<string, string>);
  }

  const entity = String(config.entity ?? '');

  if (action === 'launch_activity_plan') {
    let ownerId: string | null = null;
    if (typeof config.ownerField === 'string') {
      const owner = readPath(event.payload, config.ownerField);
      if (owner !== undefined && owner !== null) {
        if (typeof owner !== 'string' || !UUID_RE.test(owner)) return false;
        ownerId = owner;
      }
    }
    if (config.cancelPrevious) {
      const cancelled = await cancelPlanRuns(ctx, entity, recordId);
      if (!cancelled.ok) return false;
    }
    const launched = await launchPlan(ctx, String(config.planId), entity, recordId, todayIso(), ownerId);
    return launched.ok;
  }

  if (action === 'cancel_activity_plans') {
    const cancelled = await cancelPlanRuns(ctx, entity, recordId);
    return cancelled.ok;
  }

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
 * Sets whitelisted columns on one record of the company. Only non-state fields are in the whitelist,
 * so state changes always go through the module's transition or lead services.
 */
export async function updateRecord(
  ctx: Ctx,
  recordId: string,
  entity: UpdateEntity,
  updates: Record<string, string>,
): Promise<boolean> {
  const spec = RECORD_ENTITIES[entity];
  const fields = Object.entries(updates);
  if (fields.length === 0) return false;
  for (const [field, value] of fields) {
    if (checkUpdateValue(entity, field, value) !== null) return false;
    // User-id fields must name an active member of this company.
    if (UPDATABLE_FIELDS[entity][field]?.userId) {
      const members = await assertMembers(ctx, [value]);
      if (!members.ok) return false;
    }
  }
  const assignments = fields.map(([field, value]) => sql`${sql.identifier(field)} = ${value}`);
  const res = await ctx.tx.execute(
    sql`update ${sql.identifier(spec.table)} set ${sql.join(assignments, sql`, `)}, updated_at = now()
      where id = ${recordId}::uuid and company_id = ${ctx.companyId}::uuid returning id`,
  );
  if (res.rows.length === 0) return false;
  await audit(ctx, { entity: spec.chatterEntity, recordId, action: 'automation_update', after: updates });
  return true;
}

/**
 * Runs `fn` in a savepoint. A failure rolls back only this rule, so the business transaction survives.
 * Returns false when fn throws.
 */
export async function runInSavepoint(ctx: Ctx, fn: (sub: Ctx) => Promise<boolean>): Promise<boolean> {
  try {
    return await ctx.tx.transaction(async (sp) => fn({ ...ctx, tx: sp }));
  } catch {
    return false;
  }
}

/**
 * Runs every active event rule for this event whose conditions match. Call after each emit, inside ctx.tx.
 * Returns how many rules ran. Failed actions are skipped, not thrown, so the business transaction survives.
 */
export async function runAutomations(ctx: Ctx, event: DomainEvent): Promise<number> {
  const rules = await ctx.tx
    .select()
    .from(automationRules)
    .where(
      and(
        eq(automationRules.companyId, ctx.companyId),
        eq(automationRules.active, true),
        eq(automationRules.kind, 'event'),
        eq(automationRules.triggerEvent, event.name),
      ),
    );

  let ran = 0;
  for (const rule of rules) {
    const conditions = conditionsSchema.safeParse(rule.conditions);
    if (!conditions.success || !matchesConditions(event.payload, conditions.data)) continue;
    if (!(rule.action in actionConfigSchemas)) continue;
    if (!canRunRule(rule.id)) continue;
    const action = rule.action as ActionName;
    const done = await runInRuleChain(rule.id, () =>
      runInSavepoint(ctx, (sub) => executeAction(sub, event, action, rule.actionConfig)),
    );
    if (done) ran += 1;
  }
  return ran;
}
