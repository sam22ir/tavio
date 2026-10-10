// Storefront contact form. Anonymous like checkout: runs on the owner connection, filters by the company
// resolved from the slug, and writes through the company owner's context.
import { and, count, eq, gte } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/core/db/client';
import type { Db } from '@/core/db/types';
import { err, ok, type Result } from '@/core/result';
import { createLead } from '@/modules/crm/service/leads';
import { ensureDefaultPipeline } from '@/modules/crm/service/pipeline';
import { leads, pipelines } from '@/modules/crm/schema';
import { postMessage, scheduleActivity, todayIso } from '@/modules/chatter/service';
import { isRateLimited, normalizeWhatsappPhone, RATE_LIMIT_WINDOW_MS, WILAYA_RE } from './rules';
import { resolveShop } from './public';
import { ownerCtx } from './system-ctx';

export const CONTACT_PERMS = ['crm.lead.read', 'crm.lead.write', 'chatter.message.write'] as const;

const emptyToUndefined = (v: unknown): unknown => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export const contactInput = z.object({
  slug: z.string().max(60),
  name: z.string().trim().min(2).max(100),
  phone: z.string().max(30),
  email: z.preprocess(emptyToUndefined, z.string().trim().email().max(254).optional()),
  wilayaCode: z.string().regex(WILAYA_RE),
  message: z.string().trim().min(5).max(2000),
  // Honeypot: hidden from people, filled in by bots. Never a real field.
  website: z.string().max(200).optional(),
});
export type ContactInput = z.infer<typeof contactInput>;

/**
 * Creates a CRM lead (source "site web") in the company's default pipeline. The message goes in as a
 * chatter note, and a call activity is assigned to the pipeline's first salesperson, or the owner.
 * Rate-limited per phone, like checkout. A filled honeypot is accepted and stores nothing.
 */
export async function submitWebsiteContact(raw: unknown, db: Db = getDb()): Promise<Result<{ leadId: string | null }>> {
  const parsed = contactInput.safeParse(raw);
  if (!parsed.success) return err('VALIDATION', 'invalid contact input');
  const input = parsed.data;
  if (input.website) return ok({ leadId: null });

  const phone = normalizeWhatsappPhone(input.phone);
  if (!phone) return err('VALIDATION', 'invalid phone', { field: 'phone' });

  const resolved = await resolveShop(input.slug, db);
  if (!resolved) return err('NOT_FOUND', 'shop not found');
  const { companyId } = resolved;

  return db.transaction(async (tx): Promise<Result<{ leadId: string | null }>> => {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const [recent] = await tx
      .select({ n: count() })
      .from(leads)
      .where(
        and(
          eq(leads.companyId, companyId),
          eq(leads.phone, phone),
          eq(leads.source, 'website'),
          gte(leads.createdAt, since),
        ),
      );
    if (isRateLimited(Number(recent?.n ?? 0))) {
      return err('CONFLICT', 'too many messages', { reason: 'RATE_LIMITED' });
    }

    const ctx = await ownerCtx(tx, companyId, 'fr', CONTACT_PERMS);
    if (!ctx) return err('INTERNAL', 'shop has no owner');

    const pipeline = await ensureDefaultPipeline(ctx);
    if (!pipeline.ok) return err(pipeline.error.code, pipeline.error.message);
    const [pipelineRow] = await tx
      .select({ teamUserIds: pipelines.teamUserIds })
      .from(pipelines)
      .where(and(eq(pipelines.companyId, companyId), eq(pipelines.id, pipeline.value.id)))
      .limit(1);
    const assigneeId = pipelineRow?.teamUserIds?.[0] ?? ctx.userId;

    const created = await createLead(ctx, {
      name: input.name,
      contactName: input.name,
      phone,
      email: input.email,
      wilayaCode: input.wilayaCode,
      source: 'website',
      pipelineId: pipeline.value.id,
      salespersonId: assigneeId,
    });
    if (!created.ok) return err(created.error.code, created.error.message, created.error.details);

    const note = await postMessage(ctx, {
      entity: 'crm.lead',
      recordId: created.value.id,
      kind: 'note',
      body: input.message,
    });
    if (!note.ok) return err(note.error.code, note.error.message);

    // The activity is a convenience. A failure here must not lose the lead.
    await scheduleActivity(ctx, {
      entity: 'crm.lead',
      recordId: created.value.id,
      typeKey: 'call',
      summary: `Site web: ${input.name}`,
      dueDate: todayIso(),
      assigneeId,
    });

    return ok({ leadId: created.value.id });
  });
}
