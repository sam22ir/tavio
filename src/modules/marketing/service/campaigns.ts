import { and, asc, count, eq, ilike, sql, type SQL } from 'drizzle-orm';
import { WILAYA_CODE_RE } from '@/core/tenancy/wilayas';
import { z } from 'zod';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import type { ListQuery, ListResult, Row } from '@/core/entities/types';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { companies } from '@/core/db/schema/tenancy';
import { partners } from '@/modules/contacts/schema';
import { campaignRecipients, campaigns, type Campaign } from '../schema';
import {
  canBuildRecipients,
  isEditable,
  nextCampaignState,
  personalize,
} from './message';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WILAYA_RE = WILAYA_CODE_RE;
const MAX_PAGE_SIZE = 100;
const MAX_MESSAGE = 1000;
const READ = 'marketing.campaign.read';
const WRITE = 'marketing.campaign.write';

// Checkbox input: an HTML checkbox sends "on" when checked and nothing otherwise.
const flag = z.preprocess((v) => v === true || v === 'on' || v === 'true', z.boolean());
const trimmed = (max: number) =>
  z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().max(max));

// Shape validation at the boundary. Business rules live in normalizeCampaign.
export const campaignInput = z.object({
  name: trimmed(200),
  channel: z.enum(['whatsapp', 'sms', 'email']),
  language: z.enum(['fr', 'ar']),
  messageFr: trimmed(MAX_MESSAGE),
  messageAr: trimmed(MAX_MESSAGE),
  segmentCustomer: flag,
  segmentProspect: flag,
  segmentWilaya: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() || undefined : v),
    z.string().regex(WILAYA_RE).optional(),
  ),
  segmentHasOverdue: flag,
});

export type CampaignInput = z.infer<typeof campaignInput>;

export interface CampaignSegment {
  customer: boolean;
  prospect: boolean;
  wilaya?: string;
  hasOverdue: boolean;
}

export interface CampaignValues {
  name: string;
  channel: 'whatsapp' | 'sms' | 'email';
  language: 'fr' | 'ar';
  messageFr: string;
  messageAr: string;
  segment: CampaignSegment;
}

/** Campaign as returned to callers. The segment is typed; the DB column is jsonb. */
export type CampaignRow = Omit<Campaign, 'segment'> & { segment: CampaignSegment };

export type RecipientRow = {
  id: string;
  partnerId: string;
  partnerName: string;
  phone: string;
  status: string;
  sentAt: Date | null;
};

/** Applies the business rules that the shape schema cannot express. Pure. */
export function normalizeCampaign(input: CampaignInput): Result<CampaignValues> {
  if (!input.name) return err('VALIDATION', 'Name is required', { field: 'name' });
  if (!input.messageFr) return err('VALIDATION', 'French message is required', { field: 'messageFr' });
  if (!input.messageAr) return err('VALIDATION', 'Arabic message is required', { field: 'messageAr' });
  return ok({
    name: input.name,
    channel: input.channel,
    language: input.language,
    messageFr: input.messageFr,
    messageAr: input.messageAr,
    segment: {
      customer: input.segmentCustomer,
      prospect: input.segmentProspect,
      wilaya: input.segmentWilaya,
      hasOverdue: input.segmentHasOverdue,
    },
  });
}

/** Flattens a campaign row for RecordForm defaults. */
export function campaignFormValues(row: CampaignRow): Partial<Row> {
  return {
    name: row.name,
    channel: row.channel,
    language: row.language,
    messageFr: row.messageFr,
    messageAr: row.messageAr,
    segmentCustomer: row.segment.customer,
    segmentProspect: row.segment.prospect,
    segmentWilaya: row.segment.wilaya ?? '',
    segmentHasOverdue: row.segment.hasOverdue,
    state: row.state,
  };
}

function toRow(c: Campaign): CampaignRow {
  return { ...c, segment: (c.segment ?? {}) as CampaignSegment };
}

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const CAMPAIGN_STATES = ['draft', 'ready', 'sent'] as const;

export async function listCampaigns(ctx: Ctx, query: ListQuery): Promise<Result<ListResult<CampaignRow>>> {
  const perm = requirePerm(ctx, READ);
  if (!perm.ok) return perm;

  const conditions: SQL[] = [eq(campaigns.companyId, ctx.companyId)];
  const term = query.q?.trim();
  if (term) conditions.push(ilike(campaigns.name, `%${escapeLike(term)}%`));
  if (query.filters.channel) conditions.push(eq(campaigns.channel, query.filters.channel));
  if (query.filters.language) conditions.push(eq(campaigns.language, query.filters.language));
  if (query.filters.state && (CAMPAIGN_STATES as readonly string[]).includes(query.filters.state)) {
    conditions.push(eq(campaigns.state, query.filters.state));
  }
  const where = and(...conditions);

  const pageSize = Math.min(Math.max(1, query.pageSize), MAX_PAGE_SIZE);
  const page = Math.max(1, query.page);

  const [totalRow] = await ctx.tx.select({ n: count() }).from(campaigns).where(where);
  const rows = await ctx.tx
    .select()
    .from(campaigns)
    .where(where)
    .orderBy(asc(campaigns.name), asc(campaigns.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return ok({ rows: rows.map(toRow), total: Number(totalRow?.n ?? 0), page, pageSize });
}

export async function getCampaign(ctx: Ctx, id: string): Promise<Result<CampaignRow>> {
  const perm = requirePerm(ctx, READ);
  if (!perm.ok) return perm;
  if (!UUID_RE.test(id)) return err('NOT_FOUND', 'Campaign not found');

  const [row] = await ctx.tx
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.companyId, ctx.companyId)))
    .limit(1);
  if (!row) return err('NOT_FOUND', 'Campaign not found');
  return ok(toRow(row));
}

export async function createCampaign(ctx: Ctx, input: CampaignValues): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, WRITE);
  if (!perm.ok) return perm;

  const [row] = await ctx.tx
    .insert(campaigns)
    .values({ ...input, companyId: ctx.companyId, createdBy: ctx.userId, state: 'draft' })
    .returning({ id: campaigns.id });
  if (!row) return err('INTERNAL', 'Insert failed');

  await audit(ctx, { entity: 'marketing.campaign', recordId: row.id, action: 'create', after: input });
  return ok({ id: row.id });
}

/** Edits a draft or ready campaign. Any change to a ready campaign drops its recipients and resets it to draft. */
export async function updateCampaign(ctx: Ctx, id: string, input: CampaignValues): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, WRITE);
  if (!perm.ok) return perm;
  const current = await getCampaign(ctx, id);
  if (!current.ok) return current;
  if (!isEditable(current.value.state)) {
    return err('POSTED_IMMUTABLE', 'A sent campaign cannot be edited', { state: current.value.state });
  }

  if (current.value.state === 'ready') {
    await ctx.tx
      .delete(campaignRecipients)
      .where(and(eq(campaignRecipients.companyId, ctx.companyId), eq(campaignRecipients.campaignId, id)));
  }
  await ctx.tx
    .update(campaigns)
    .set({ ...input, state: 'draft', updatedAt: new Date() })
    .where(and(eq(campaigns.id, id), eq(campaigns.companyId, ctx.companyId)));

  await audit(ctx, {
    entity: 'marketing.campaign',
    recordId: id,
    action: 'update',
    before: current.value,
    after: input,
  });
  return ok({ id });
}

/** Builds the recipient list from the segment. Partners without a phone are skipped. */
/** Partner conditions for a campaign segment. Shared by the WhatsApp recipient build and the email queue. */
export function segmentConditions(ctx: Ctx, seg: CampaignSegment, today: string): SQL[] {
  const conditions: SQL[] = [
    eq(partners.companyId, ctx.companyId),
    eq(partners.active, true),
  ];
  if (seg.customer) conditions.push(eq(partners.isCustomer, true));
  if (seg.prospect) conditions.push(eq(partners.isProspect, true));
  if (seg.wilaya) conditions.push(eq(partners.wilayaCode, seg.wilaya));
  if (seg.hasOverdue) {
    // Partners with an unpaid, past-due installment on a live credit contract.
    conditions.push(sql`exists (
      select 1 from installments i
      join contracts c on c.id = i.contract_id
      where c.partner_id = ${partners.id}
        and i.company_id = ${ctx.companyId}
        and i.due_date < ${today}
        and i.paid_cents < i.amount_cents
        and c.state in ('active', 'defaulted')
    )`);
  }

  return conditions;
}

export async function buildRecipients(
  ctx: Ctx,
  id: string,
  today: string,
): Promise<Result<{ count: number; skippedNoPhone: number }>> {
  const perm = requirePerm(ctx, WRITE);
  if (!perm.ok) return perm;
  const current = await getCampaign(ctx, id);
  if (!current.ok) return current;

  const existing = await ctx.tx
    .select({ status: campaignRecipients.status })
    .from(campaignRecipients)
    .where(and(eq(campaignRecipients.companyId, ctx.companyId), eq(campaignRecipients.campaignId, id)));
  if (!canBuildRecipients(current.value.state, existing.map((r) => r.status))) {
    return err('STATE', 'Recipients are already being handled', { state: current.value.state });
  }

  const conditions = segmentConditions(ctx, current.value.segment, today);

  const matched = await ctx.tx
    .select({ id: partners.id, phone: partners.phone })
    .from(partners)
    .where(and(...conditions));
  const withPhone = matched.filter((p): p is { id: string; phone: string } => p.phone !== null);

  await ctx.tx
    .delete(campaignRecipients)
    .where(and(eq(campaignRecipients.companyId, ctx.companyId), eq(campaignRecipients.campaignId, id)));
  if (withPhone.length > 0) {
    await ctx.tx.insert(campaignRecipients).values(
      withPhone.map((p) => ({
        companyId: ctx.companyId,
        campaignId: id,
        partnerId: p.id,
        phone: p.phone,
        status: 'pending',
        createdBy: ctx.userId,
      })),
    );
  }
  await ctx.tx
    .update(campaigns)
    .set({ state: 'ready', updatedAt: new Date() })
    .where(and(eq(campaigns.id, id), eq(campaigns.companyId, ctx.companyId)));

  const result = { count: withPhone.length, skippedNoPhone: matched.length - withPhone.length };
  await audit(ctx, { entity: 'marketing.campaign', recordId: id, action: 'build_recipients', after: result });
  return ok(result);
}

/** Lists recipients with the partner name and the personalised message for the campaign language. */
export async function listRecipients(
  ctx: Ctx,
  campaignId: string,
): Promise<Result<{ campaign: CampaignRow; shop: string; rows: (RecipientRow & { message: string })[] }>> {
  const campaign = await getCampaign(ctx, campaignId);
  if (!campaign.ok) return campaign;

  const [company] = await ctx.tx
    .select({ displayName: companies.displayName })
    .from(companies)
    .where(eq(companies.id, ctx.companyId))
    .limit(1);
  const shop = company?.displayName ?? '';

  const rows = await ctx.tx
    .select({
      id: campaignRecipients.id,
      partnerId: campaignRecipients.partnerId,
      partnerName: partners.displayName,
      phone: campaignRecipients.phone,
      status: campaignRecipients.status,
      sentAt: campaignRecipients.sentAt,
    })
    .from(campaignRecipients)
    .innerJoin(partners, eq(partners.id, campaignRecipients.partnerId))
    .where(and(eq(campaignRecipients.companyId, ctx.companyId), eq(campaignRecipients.campaignId, campaignId)))
    .orderBy(asc(partners.displayName), asc(campaignRecipients.id));

  const template = campaign.value.language === 'ar' ? campaign.value.messageAr : campaign.value.messageFr;
  return ok({
    campaign: campaign.value,
    shop,
    rows: rows.map((r) => ({ ...r, message: personalize(template, { name: r.partnerName, shop }) })),
  });
}

/** Marks one recipient as pending, sent or failed, then recomputes the campaign state. */
export async function setRecipientStatus(
  ctx: Ctx,
  recipientId: string,
  status: 'pending' | 'sent' | 'failed',
): Promise<Result<{ campaignId: string; state: string }>> {
  const perm = requirePerm(ctx, WRITE);
  if (!perm.ok) return perm;
  if (!UUID_RE.test(recipientId)) return err('NOT_FOUND', 'Recipient not found');

  const [row] = await ctx.tx
    .select({ campaignId: campaignRecipients.campaignId, status: campaignRecipients.status })
    .from(campaignRecipients)
    .where(and(eq(campaignRecipients.id, recipientId), eq(campaignRecipients.companyId, ctx.companyId)))
    .limit(1);
  if (!row) return err('NOT_FOUND', 'Recipient not found');

  const campaign = await getCampaign(ctx, row.campaignId);
  if (!campaign.ok) return campaign;

  await ctx.tx
    .update(campaignRecipients)
    .set({ status, sentAt: status === 'sent' ? new Date() : null, updatedAt: new Date() })
    .where(eq(campaignRecipients.id, recipientId));

  const statuses = await ctx.tx
    .select({ status: campaignRecipients.status })
    .from(campaignRecipients)
    .where(and(eq(campaignRecipients.companyId, ctx.companyId), eq(campaignRecipients.campaignId, row.campaignId)));
  const state = nextCampaignState(statuses.map((s) => s.status));

  await ctx.tx
    .update(campaigns)
    .set({ state, updatedAt: new Date() })
    .where(and(eq(campaigns.id, row.campaignId), eq(campaigns.companyId, ctx.companyId)));

  await audit(ctx, {
    entity: 'marketing.campaign',
    recordId: row.campaignId,
    action: 'recipient_status',
    before: { recipientId, status: row.status },
    after: { recipientId, status, state },
  });
  return ok({ campaignId: row.campaignId, state });
}
