import { and, eq, sql } from 'drizzle-orm';
import type { OutboxRow } from '@/core/events';
import { getDb } from '@/core/db/client';
import type { Db } from '@/core/db/types';
import { deliverEvent } from './service/webhooks';
import { webhookDeliveries, webhooks } from './schema';

/**
 * Delivers one outbox event to every active webhook of its company that subscribes to it.
 * Runs on the owner connection from the outbox drain (no tenant context), so it filters by
 * row.companyId explicitly. Idempotent per (webhook, outbox row): sent deliveries are skipped.
 * Throws when any delivery fails so drainOutbox records the attempt and retries later.
 */
export async function handleOutboxRow(row: OutboxRow, db: Db = getDb()): Promise<void> {
  const targets = await db
    .select()
    .from(webhooks)
    .where(
      and(
        eq(webhooks.companyId, row.companyId),
        eq(webhooks.active, true),
        sql`${webhooks.events} @> array[${row.eventName}]::text[]`,
      ),
    );

  const failures: string[] = [];
  for (const webhook of targets) {
    await db
      .insert(webhookDeliveries)
      .values({
        companyId: row.companyId,
        webhookId: webhook.id,
        outboxId: row.id,
        eventName: row.eventName,
        payload: row.payload as object,
        status: 'pending',
      })
      .onConflictDoNothing({ target: [webhookDeliveries.webhookId, webhookDeliveries.outboxId] });

    const [delivery] = await db
      .select()
      .from(webhookDeliveries)
      .where(and(eq(webhookDeliveries.webhookId, webhook.id), eq(webhookDeliveries.outboxId, row.id)))
      .limit(1);
    if (!delivery || delivery.status === 'sent') continue;

    const result = await deliverEvent({
      deliveryId: delivery.id,
      outboxId: row.id,
      webhook,
      eventName: row.eventName,
      payload: row.payload,
    });

    await db
      .update(webhookDeliveries)
      .set({
        status: result.ok ? 'sent' : 'failed',
        attempts: delivery.attempts + 1,
        lastError: result.ok ? null : (result.error ?? 'unknown'),
        updatedAt: new Date(),
      })
      .where(eq(webhookDeliveries.id, delivery.id));

    if (!result.ok) failures.push(`${webhook.id}:${result.error ?? 'unknown'}`);
  }

  if (failures.length > 0) {
    throw new Error(`webhook delivery failed for ${failures.length} endpoint(s)`);
  }
}
