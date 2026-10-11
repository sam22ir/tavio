import { and, eq, sql } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { companies } from '@/core/db/schema/tenancy';
import { messageOptOuts } from '@/core/db/schema/messaging';
import { campaigns } from '../schema';
import { partners } from '@/modules/contacts/schema';
import { queueMessage } from '@/core/messaging/outbox';
import { buildUnsubscribeUrl } from '@/core/messaging/unsubscribe';
import { readPortalBaseUrl, readPortalSecret } from '@/core/portal/env';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { messageLocaleFor, textToHtml, withUnsubscribe, type MessageLocale } from '@/core/messaging/template';
import { getCampaign, segmentConditions } from './campaigns';
import { personalize } from './message';

const WRITE = 'marketing.campaign.write';

export interface CampaignEmailResult { queued: number; duplicates: number; optedOut: number; noEmail: number }

/**
 * Queues the email version of a campaign through the messaging outbox. The outbox cron sends it in batches.
 * Every message has an unsubscribe link. Opted-out partners and partners without an email are skipped.
 * The campaign then becomes sent, so it can no longer be edited.
 */
export async function queueCampaignEmails(ctx: Ctx, id: string, today: string): Promise<Result<CampaignEmailResult>> {
  const perm = requirePerm(ctx, WRITE);
  if (!perm.ok) return perm;
  const current = await getCampaign(ctx, id);
  if (!current.ok) return current;
  const campaign = current.value;
  if (campaign.channel !== 'email') return err('VALIDATION', 'Campaign channel is not email', { field: 'channel' });
  if (campaign.state === 'sent') return err('STATE', 'Campaign already sent', { state: campaign.state });

  const base = readPortalBaseUrl();
  const secret = readPortalSecret();
  if (!base || !secret) return err('INTERNAL', 'PORTAL_BASE_URL or BETTER_AUTH_URL must be set');

  const [company] = await ctx.tx
    .select({ name: companies.displayName, locale: companies.defaultLocale })
    .from(companies)
    .where(eq(companies.id, ctx.companyId));
  const locale: MessageLocale = messageLocaleFor(company?.locale ?? 'fr');
  const language = campaign.language as MessageLocale;
  const template = language === 'ar' ? campaign.messageAr : campaign.messageFr;
  const shop = company?.name ?? '';

  const conditions = segmentConditions(ctx, campaign.segment, today);
  const rows = await ctx.tx
    .select({ id: partners.id, name: partners.displayName, email: partners.email })
    .from(partners)
    .where(and(...conditions, sql`${partners.email} is not null`));

  const optOuts = new Set(
    (await ctx.tx
      .select({ partnerId: messageOptOuts.partnerId })
      .from(messageOptOuts)
      .where(and(eq(messageOptOuts.companyId, ctx.companyId), eq(messageOptOuts.channel, 'email')))).map((r) => r.partnerId),
  );

  const result: CampaignEmailResult = { queued: 0, duplicates: 0, optedOut: 0, noEmail: 0 };
  for (const p of rows) {
    if (!p.email?.trim()) {
      result.noEmail += 1;
      continue;
    }
    if (optOuts.has(p.id)) {
      result.optedOut += 1;
      continue;
    }
    const text = personalize(template, { name: p.name, shop });
    const unsub = await buildUnsubscribeUrl(base, { c: ctx.companyId, p: p.id, ch: 'email' }, secret);
    const footered = withUnsubscribe({ subject: campaign.name, text, html: textToHtml(text) }, unsub, language);
    const q = await queueMessage(ctx, {
      channel: 'email',
      to: p.email.trim(),
      subject: campaign.name,
      html: footered.html,
      text: footered.text,
      partnerId: p.id,
      templateKey: null,
      relatedEntity: 'marketing.campaign',
      relatedId: id,
      dedupeKey: `campaign:${id}:${p.id}`,
    });
    if (!q.ok) return q;
    if (q.value.duplicate) result.duplicates += 1;
    else result.queued += 1;
  }

  await ctx.tx
    .update(campaigns)
    .set({ state: 'sent', updatedAt: sql`now()` })
    .where(and(eq(campaigns.id, id), eq(campaigns.companyId, ctx.companyId)));
  await audit(ctx, { action: 'send', entity: 'marketing.campaign', recordId: id, after: { ...result, locale } });
  return ok(result);
}
