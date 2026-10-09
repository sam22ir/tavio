import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { webhooks, type Webhook } from '../schema';
import { SIGNATURE_HEADER, signPayload } from './signature';
import { WEBHOOK_EVENTS } from '../constants';

const READ = 'platform.webhook.read';
const WRITE = 'platform.webhook.write';

export { WEBHOOK_EVENTS } from '../constants';

export function isWebhookEvent(value: string): boolean {
  return (WEBHOOK_EVENTS as readonly string[]).includes(value);
}

/** Endpoints must be HTTPS. Plain HTTP is only accepted for localhost during development. */
export function validateWebhookUrl(raw: string): Result<string> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return err('VALIDATION', 'url is not a valid URL');
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    return err('VALIDATION', 'webhook url must use https');
  }
  return ok(url.toString());
}

export interface WebhookSummary {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: Date;
}

export async function listWebhooks(ctx: Ctx): Promise<Result<WebhookSummary[]>> {
  const perm = requirePerm(ctx, READ);
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select({
      id: webhooks.id,
      url: webhooks.url,
      events: webhooks.events,
      active: webhooks.active,
      createdAt: webhooks.createdAt,
    })
    .from(webhooks)
    .where(eq(webhooks.companyId, ctx.companyId));
  return ok(rows);
}

/** Creates an endpoint. The returned `secret` is shown once; it signs every delivery. */
export async function createWebhook(
  ctx: Ctx,
  input: { url: string; events: string[] },
): Promise<Result<{ id: string; secret: string }>> {
  const perm = requirePerm(ctx, WRITE);
  if (!perm.ok) return perm;
  const url = validateWebhookUrl(input.url);
  if (!url.ok) return url;
  const events = [...new Set(input.events)];
  if (events.length === 0 || !events.every(isWebhookEvent)) {
    return err('VALIDATION', 'choose at least one known event');
  }

  const secret = randomBytes(32).toString('hex');
  const [row] = await ctx.tx
    .insert(webhooks)
    .values({ companyId: ctx.companyId, createdBy: ctx.userId, url: url.value, events, secret })
    .returning({ id: webhooks.id });
  if (!row) return err('INTERNAL', 'insert returned no row');

  await audit(ctx, { entity: 'platform.webhook', recordId: row.id, action: 'create', after: { url: url.value, events } });
  return ok({ id: row.id, secret });
}

export async function setWebhookActive(ctx: Ctx, id: string, active: boolean): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, WRITE);
  if (!perm.ok) return perm;
  const [row] = await ctx.tx
    .update(webhooks)
    .set({ active, updatedAt: new Date() })
    .where(and(eq(webhooks.id, id), eq(webhooks.companyId, ctx.companyId)))
    .returning({ id: webhooks.id });
  if (!row) return err('NOT_FOUND', 'webhook not found');
  await audit(ctx, { entity: 'platform.webhook', recordId: row.id, action: active ? 'enable' : 'disable' });
  return ok({ id: row.id });
}

export interface DeliveryRequest {
  deliveryId: string;
  outboxId: string;
  webhook: Pick<Webhook, 'url' | 'secret'>;
  eventName: string;
  payload: unknown;
}

export interface DeliveryResult {
  ok: boolean;
  status: number | null;
  error: string | null;
}

/** POSTs one signed event. Never throws: network and timeout errors come back as ok=false. */
export async function deliverEvent(
  req: DeliveryRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<DeliveryResult> {
  const body = JSON.stringify({
    id: req.outboxId,
    event: req.eventName,
    data: req.payload,
  });
  try {
    const res = await fetchImpl(req.webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tavio-Event': req.eventName,
        'X-Tavio-Delivery': req.deliveryId,
        [SIGNATURE_HEADER]: signPayload(req.webhook.secret, body),
      },
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
    const success = res.status >= 200 && res.status < 300;
    return { ok: success, status: res.status, error: success ? null : `HTTP ${res.status}` };
  } catch (e) {
    const name = e instanceof Error ? e.name : 'Error';
    return { ok: false, status: null, error: name };
  }
}
