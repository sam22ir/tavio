import { and, asc, eq, lte, sql } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { outboundMessages } from '@/core/db/schema/messaging';
import type { Db } from '@/core/db/types';
import { err, ok, type Result } from '@/core/result';
import { channelFor, type ChannelId } from './channels';
import { applyOutcome, type SendOutcome } from './outbox-state';

export interface QueueMessageInput {
  channel: ChannelId;
  /** Email address, or E.164 phone for whatsapp. */
  to: string;
  subject: string;
  html: string;
  text: string;
  partnerId?: string | null;
  templateKey?: string | null;
  relatedEntity?: string | null;
  relatedId?: string | null;
  /** Same key twice in one company inserts nothing (automatic reminders). */
  dedupeKey?: string | null;
  /** True when a transactional send went out although the partner opted out. */
  overrideOptOut?: boolean;
  /** WhatsApp only: the row starts as manual with this wa.me link, since a person sends it. */
  waUrl?: string | null;
}

/**
 * Inserts an outbox row in the caller's transaction (ctx.tx), so it commits or rolls back with the business write.
 * Returns duplicate: true when the dedupe key already existed. Never sends anything itself.
 */
export async function queueMessage(ctx: Ctx, input: QueueMessageInput): Promise<Result<{ id: string | null; duplicate: boolean }>> {
  if (!input.to.trim()) return err('VALIDATION', 'Recipient is required', { field: 'to' });
  if (input.channel === 'whatsapp' && !input.waUrl) return err('VALIDATION', 'WhatsApp messages need a link');
  const manual = input.channel === 'whatsapp';
  const rows = await ctx.tx
    .insert(outboundMessages)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      channel: input.channel,
      toAddress: input.to.trim(),
      partnerId: input.partnerId ?? null,
      subject: input.subject,
      bodyHtml: input.html,
      bodyText: input.text,
      templateKey: input.templateKey ?? null,
      relatedEntity: input.relatedEntity ?? null,
      relatedId: input.relatedId ?? null,
      state: manual ? 'manual' : 'queued',
      waUrl: input.waUrl ?? null,
      overrideOptOut: input.overrideOptOut ?? false,
      dedupeKey: input.dedupeKey ?? null,
    })
    .onConflictDoNothing({
      target: [outboundMessages.companyId, outboundMessages.dedupeKey],
      where: sql`${outboundMessages.dedupeKey} is not null`,
    })
    .returning({ id: outboundMessages.id });
  const row = rows[0];
  return ok({ id: row?.id ?? null, duplicate: !row });
}

export interface DrainResult { claimed: number; sent: number; manual: number; retried: number; failed: number }

/**
 * Sends due queued rows. Runs as the owner connection (like drainOutbox), one transaction per batch.
 * A send error is recorded on the row and retried with backoff until MAX_ATTEMPTS, then the row is failed.
 */
export async function drainMessages(db: Db, limit = 50, now: Date = new Date()): Promise<DrainResult> {
  return db.transaction(async (tx) => {
    const claimed = await tx
      .select()
      .from(outboundMessages)
      .where(and(eq(outboundMessages.state, 'queued'), lte(outboundMessages.availableAt, now)))
      .orderBy(asc(outboundMessages.availableAt))
      .limit(limit)
      .for('update', { skipLocked: true });

    const result: DrainResult = { claimed: claimed.length, sent: 0, manual: 0, retried: 0, failed: 0 };
    for (const row of claimed) {
      const channel = channelFor(row.channel);
      let outcome: SendOutcome;
      if (!channel) {
        outcome = { status: 'failed', error: `Unknown channel ${row.channel}` };
      } else {
        const sent = await channel.send({ to: row.toAddress, subject: row.subject, html: row.bodyHtml, text: row.bodyText });
        outcome = sent.status === 'failed'
          ? { status: 'failed', error: sent.error }
          : sent.status === 'manual'
            ? { status: 'manual', url: sent.url }
            : { status: 'sent', providerId: sent.providerId };
      }
      const update = applyOutcome({ attempts: row.attempts }, outcome, now);
      await tx
        .update(outboundMessages)
        .set({
          state: update.state,
          attempts: update.attempts,
          availableAt: update.availableAt ?? row.availableAt,
          lastError: update.lastError,
          providerId: update.providerId ?? row.providerId,
          sentAt: update.sentAt ?? row.sentAt,
          waUrl: update.waUrl ?? row.waUrl,
          updatedAt: sql`now()`,
        })
        .where(and(eq(outboundMessages.id, row.id), eq(outboundMessages.state, 'queued')));
      if (update.state === 'sent') result.sent += 1;
      else if (update.state === 'manual') result.manual += 1;
      else if (update.state === 'failed') result.failed += 1;
      else result.retried += 1;
    }
    return result;
  });
}
