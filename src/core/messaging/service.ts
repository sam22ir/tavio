import { and, count, desc, eq, sql, type SQL } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx, Locale } from '@/core/ctx';
import { companies } from '@/core/db/schema/tenancy';
import { messageOptOuts, messageSettings, messageTemplates, outboundMessages } from '@/core/db/schema/messaging';
import { formatDzd } from '@/core/money';
import { requirePerm } from '@/core/perms';
import { createPortalLink } from '@/core/portal/links';
import { err, ok, type Result } from '@/core/result';
import { postMessage } from '@/modules/chatter/service';
import { partners } from '@/modules/contacts/schema';
import { creditContracts, creditReceipts } from '@/modules/credit_sales/schema';
import { invoices } from '@/modules/invoicing/schema';
import { markOrderSent } from '@/modules/sales/service/orders';
import { saleOrders } from '@/modules/sales/schema';
import { waMeUrl } from './channels';
import { queueMessage } from './outbox';
import {
  DEFAULT_TEMPLATES,
  findUnknownVariables,
  isTemplateKey,
  messageLocaleFor,
  renderMessage,
  TEMPLATE_KEYS,
  TEMPLATE_VARIABLES,
  textToHtml,
  type MessageLocale,
  type TemplateCopy,
  type TemplateKey,
} from './template';

export const TEMPLATE_PERM = 'messaging.template.write';
export const LOG_PERM = 'messaging.message.read';

export type DocumentEntity = 'sales.order' | 'invoicing.invoice' | 'credit_sales.contract' | 'credit_sales.receipt' | 'contacts.partner';
export type MessageChannelId = 'email' | 'whatsapp';

export interface DocumentRef { entity: DocumentEntity; recordId: string; partnerId: string }

export const DOC_PERM: Record<DocumentEntity, string> = {
  'sales.order': 'sales.order.read',
  'invoicing.invoice': 'invoicing.invoice.read',
  'credit_sales.contract': 'credit_sales.contract.read',
  'credit_sales.receipt': 'credit_sales.payment.read',
  'contacts.partner': 'contacts.partner.read',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------- Templates ----------

export interface TemplateView extends TemplateCopy {
  key: TemplateKey;
  locale: MessageLocale;
  isDefault: boolean;
  variables: readonly string[];
}

/** The company override when one exists, else the built-in default. */
export async function effectiveTemplate(ctx: Ctx, key: TemplateKey, locale: MessageLocale): Promise<TemplateView> {
  const [row] = await ctx.tx
    .select({ subject: messageTemplates.subject, body: messageTemplates.body })
    .from(messageTemplates)
    .where(and(eq(messageTemplates.companyId, ctx.companyId), eq(messageTemplates.key, key), eq(messageTemplates.locale, locale)));
  const base = row ?? DEFAULT_TEMPLATES[key][locale];
  return { key, locale, subject: base.subject, body: base.body, isDefault: !row, variables: TEMPLATE_VARIABLES[key] };
}

/** Every key and locale, for the settings page. */
export async function listTemplates(ctx: Ctx): Promise<Result<TemplateView[]>> {
  const perm = requirePerm(ctx, TEMPLATE_PERM);
  if (!perm.ok) return perm;
  const out: TemplateView[] = [];
  for (const key of TEMPLATE_KEYS) {
    for (const locale of ['fr', 'ar'] as const) out.push(await effectiveTemplate(ctx, key, locale));
  }
  return ok(out);
}

export async function saveTemplate(ctx: Ctx, key: string, locale: string, copy: { subject: string; body: string }): Promise<Result<{ key: TemplateKey }>> {
  const perm = requirePerm(ctx, TEMPLATE_PERM);
  if (!perm.ok) return perm;
  if (!isTemplateKey(key)) return err('VALIDATION', 'Unknown template', { field: 'key' });
  if (locale !== 'fr' && locale !== 'ar') return err('VALIDATION', 'Locale must be fr or ar', { field: 'locale' });
  const subject = copy.subject.trim();
  const body = copy.body.trim();
  if (!subject) return err('VALIDATION', 'Subject is required', { field: 'subject' });
  if (!body) return err('VALIDATION', 'Body is required', { field: 'body' });
  if (subject.length > 300 || body.length > 5000) return err('VALIDATION', 'Template is too long');
  const unknown = [...findUnknownVariables(key, subject), ...findUnknownVariables(key, body)];
  if (unknown.length > 0) return err('VALIDATION', `Unknown variables: ${[...new Set(unknown)].join(', ')}`, { field: 'body' });

  await ctx.tx
    .insert(messageTemplates)
    .values({ companyId: ctx.companyId, createdBy: ctx.userId, key, locale, subject, body })
    .onConflictDoUpdate({
      target: [messageTemplates.companyId, messageTemplates.key, messageTemplates.locale],
      set: { subject, body, updatedAt: sql`now()` },
    });
  await audit(ctx, { action: 'update', entity: 'messaging.template', recordId: ctx.companyId, after: { key, locale } });
  return ok({ key });
}

export async function resetTemplate(ctx: Ctx, key: string, locale: string): Promise<Result<{ key: TemplateKey }>> {
  const perm = requirePerm(ctx, TEMPLATE_PERM);
  if (!perm.ok) return perm;
  if (!isTemplateKey(key) || (locale !== 'fr' && locale !== 'ar')) return err('VALIDATION', 'Unknown template');
  await ctx.tx
    .delete(messageTemplates)
    .where(and(eq(messageTemplates.companyId, ctx.companyId), eq(messageTemplates.key, key), eq(messageTemplates.locale, locale)));
  await audit(ctx, { action: 'reset', entity: 'messaging.template', recordId: ctx.companyId, after: { key, locale } });
  return ok({ key });
}

// ---------- Reminder settings ----------

export interface MessageSettingsValues { remindersEnabled: boolean; beforeDays: number; overdueDays: number[] }
export const DEFAULT_MESSAGE_SETTINGS: MessageSettingsValues = { remindersEnabled: false, beforeDays: 3, overdueDays: [1, 7] };

/** Pure: 0 to 30 days before, and a sorted list of 0 to 60 day offsets after the due date (at most 5). */
export function normalizeSettings(input: { remindersEnabled: boolean; beforeDays: number; overdueDays: number[] }): Result<MessageSettingsValues> {
  if (!Number.isInteger(input.beforeDays) || input.beforeDays < 0 || input.beforeDays > 30) {
    return err('VALIDATION', 'Days before must be between 0 and 30', { field: 'beforeDays' });
  }
  const days = [...new Set(input.overdueDays)].sort((a, b) => a - b);
  if (days.length > 5 || days.some((d) => !Number.isInteger(d) || d < 0 || d > 60)) {
    return err('VALIDATION', 'Overdue days must be whole numbers from 0 to 60 (at most 5)', { field: 'overdueDays' });
  }
  return ok({ remindersEnabled: input.remindersEnabled, beforeDays: input.beforeDays, overdueDays: days });
}

export async function getMessageSettings(ctx: Ctx): Promise<MessageSettingsValues> {
  const [row] = await ctx.tx.select().from(messageSettings).where(eq(messageSettings.companyId, ctx.companyId));
  if (!row) return DEFAULT_MESSAGE_SETTINGS;
  return {
    remindersEnabled: row.remindersEnabled,
    beforeDays: row.beforeDays,
    overdueDays: Array.isArray(row.overdueDays) ? (row.overdueDays as number[]) : [1, 7],
  };
}

export async function saveMessageSettings(ctx: Ctx, input: { remindersEnabled: boolean; beforeDays: number; overdueDays: number[] }): Promise<Result<MessageSettingsValues>> {
  const perm = requirePerm(ctx, TEMPLATE_PERM);
  if (!perm.ok) return perm;
  const values = normalizeSettings(input);
  if (!values.ok) return values;
  const v = values.value;
  await ctx.tx
    .insert(messageSettings)
    .values({ companyId: ctx.companyId, remindersEnabled: v.remindersEnabled, beforeDays: v.beforeDays, overdueDays: v.overdueDays })
    .onConflictDoUpdate({
      target: [messageSettings.companyId],
      set: { remindersEnabled: v.remindersEnabled, beforeDays: v.beforeDays, overdueDays: v.overdueDays, updatedAt: sql`now()` },
    });
  await audit(ctx, { action: 'update', entity: 'messaging.settings', recordId: ctx.companyId, after: v });
  return ok(v);
}

// ---------- Opt-outs ----------

export async function isOptedOut(ctx: Ctx, partnerId: string, channel: MessageChannelId): Promise<boolean> {
  const rows = await ctx.tx
    .select({ id: messageOptOuts.id })
    .from(messageOptOuts)
    .where(and(eq(messageOptOuts.companyId, ctx.companyId), eq(messageOptOuts.partnerId, partnerId), eq(messageOptOuts.channel, channel)))
    .limit(1);
  return rows.length > 0;
}

// ---------- Document messages (quote, invoice, contract, receipt, portal invite) ----------

interface DocumentVars { number: string; amount: string; due_date?: string }

async function documentVars(ctx: Ctx, entity: DocumentEntity, recordId: string, locale: Locale): Promise<Result<DocumentVars>> {
  const fallback = recordId.slice(0, 8).toUpperCase();
  if (entity === 'sales.order') {
    const [row] = await ctx.tx.select({ number: saleOrders.number, total: saleOrders.totalCents }).from(saleOrders)
      .where(and(eq(saleOrders.companyId, ctx.companyId), eq(saleOrders.id, recordId)));
    if (!row) return err('NOT_FOUND', 'Record not found');
    return ok({ number: row.number ?? fallback, amount: formatDzd(row.total, locale) });
  }
  if (entity === 'invoicing.invoice') {
    const [row] = await ctx.tx.select({ number: invoices.number, total: invoices.totalCents, due: invoices.dueDate }).from(invoices)
      .where(and(eq(invoices.companyId, ctx.companyId), eq(invoices.id, recordId)));
    if (!row) return err('NOT_FOUND', 'Record not found');
    return ok({ number: row.number ?? fallback, amount: formatDzd(row.total, locale), due_date: row.due ?? '' });
  }
  if (entity === 'credit_sales.contract') {
    const [row] = await ctx.tx.select({ number: creditContracts.reference, total: creditContracts.totalCents }).from(creditContracts)
      .where(and(eq(creditContracts.companyId, ctx.companyId), eq(creditContracts.id, recordId)));
    if (!row) return err('NOT_FOUND', 'Record not found');
    return ok({ number: row.number || fallback, amount: formatDzd(row.total, locale) });
  }
  if (entity === 'credit_sales.receipt') {
    const [row] = await ctx.tx.select({ number: creditReceipts.number, total: creditReceipts.totalCents }).from(creditReceipts)
      .where(and(eq(creditReceipts.companyId, ctx.companyId), eq(creditReceipts.id, recordId)));
    if (!row) return err('NOT_FOUND', 'Record not found');
    return ok({ number: row.number, amount: formatDzd(row.total, locale) });
  }
  return ok({ number: '', amount: '' });
}

async function loadPartnerAndCompany(ctx: Ctx, partnerId: string) {
  const [partner] = await ctx.tx
    .select({ id: partners.id, name: partners.displayName, email: partners.email, phone: partners.phone, active: partners.active })
    .from(partners)
    .where(and(eq(partners.companyId, ctx.companyId), eq(partners.id, partnerId)));
  const [company] = await ctx.tx
    .select({ name: companies.displayName, locale: companies.defaultLocale })
    .from(companies)
    .where(eq(companies.id, ctx.companyId));
  return { partner: partner ?? null, company: company ?? null };
}

export interface PreparedMessage {
  templateKey: TemplateKey;
  channel: MessageChannelId;
  to: string;
  subject: string;
  body: string;
  locale: MessageLocale;
  /** The body still contains {link}; the send action replaces it with a fresh portal link. */
  optedOut: boolean;
}

/** Renders the default message for a record, for the send dialog. Pure rendering over loaded rows. */
export async function prepareDocumentMessage(
  ctx: Ctx,
  ref: DocumentRef,
  templateKey: TemplateKey,
  channel: MessageChannelId,
): Promise<Result<PreparedMessage>> {
  const perm = requirePerm(ctx, DOC_PERM[ref.entity]);
  if (!perm.ok) return perm;
  if (!UUID_RE.test(ref.recordId) || !UUID_RE.test(ref.partnerId)) return err('NOT_FOUND', 'Record not found');
  const { partner, company } = await loadPartnerAndCompany(ctx, ref.partnerId);
  if (!partner || !partner.active || !company) return err('NOT_FOUND', 'Partner not found');
  const locale = messageLocaleFor(company.locale);
  const docVars = await documentVars(ctx, ref.entity, ref.recordId, locale);
  if (!docVars.ok) return docVars;
  const copy = await effectiveTemplate(ctx, templateKey, locale);
  const rendered = renderMessage(copy, { partner: partner.name, company: company.name, ...docVars.value });
  return ok({
    templateKey,
    channel,
    to: (channel === 'email' ? partner.email : partner.phone) ?? '',
    subject: rendered.subject,
    body: rendered.text,
    locale,
    optedOut: await isOptedOut(ctx, ref.partnerId, channel),
  });
}

export interface SendDocumentInput extends DocumentRef {
  templateKey: TemplateKey;
  channel: MessageChannelId;
  to: string;
  subject: string;
  body: string;
}

const LINK_TARGET: Partial<Record<DocumentEntity, 'invoicing.invoice' | 'credit_sales.contract'>> = {
  'invoicing.invoice': 'invoicing.invoice',
  'credit_sales.contract': 'credit_sales.contract',
};

const NOTE_TEXT: Record<Locale, (channel: MessageChannelId, to: string) => string> = {
  fr: (c, to) => (c === 'email' ? `Envoyé par e-mail à ${to}` : `Message WhatsApp préparé pour ${to}`),
  ar: (c, to) => (c === 'email' ? `أُرسل بالبريد الإلكتروني إلى ${to}` : `تم تحضير رسالة واتساب إلى ${to}`),
  en: (c, to) => (c === 'email' ? `Sent by email to ${to}` : `WhatsApp message prepared for ${to}`),
};

/**
 * Queues one document message in the caller's transaction: creates the portal link, queues or prepares the row,
 * adds a chatter note and marks a draft quote as sent. A transactional send ignores an opt-out but reports it.
 */
export async function sendDocumentMessage(ctx: Ctx, input: SendDocumentInput): Promise<Result<{ id: string | null; state: 'queued' | 'manual'; waUrl: string | null; optedOut: boolean; url: string }>> {
  const perm = requirePerm(ctx, DOC_PERM[input.entity]);
  if (!perm.ok) return perm;
  if (!UUID_RE.test(input.recordId) || !UUID_RE.test(input.partnerId)) return err('NOT_FOUND', 'Record not found');
  const to = input.to.trim();
  if (input.channel === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return err('VALIDATION', 'A valid email address is required', { field: 'to' });
  if (input.channel === 'whatsapp' && to.replace(/\D/g, '').length < 8) return err('VALIDATION', 'A phone number is required', { field: 'to' });
  const subject = input.subject.trim();
  if (!subject) return err('VALIDATION', 'Subject is required', { field: 'subject' });
  if (!input.body.trim()) return err('VALIDATION', 'Body is required', { field: 'body' });

  const { partner, company } = await loadPartnerAndCompany(ctx, input.partnerId);
  if (!partner || !partner.active || !company) return err('NOT_FOUND', 'Partner not found');
  const optedOut = input.channel === 'email' ? await isOptedOut(ctx, input.partnerId, 'email') : false;

  // Every document email carries a portal link. A document link is used when the entity has one.
  const link = await createPortalLink(ctx, {
    partnerId: input.partnerId,
    target: LINK_TARGET[input.entity] ? { entity: LINK_TARGET[input.entity] as 'invoicing.invoice' | 'credit_sales.contract', id: input.recordId } : undefined,
  });
  if (!link.ok) return link;
  let body = input.body.replaceAll('{link}', link.value.url);
  if (!body.includes(link.value.url)) body = `${body}\n\n${link.value.url}`;

  const waUrl = input.channel === 'whatsapp' ? waMeUrl(to, body) : null;
  const queued = await queueMessage(ctx, {
    channel: input.channel,
    to,
    subject,
    html: textToHtml(body),
    text: body,
    partnerId: input.partnerId,
    templateKey: input.templateKey,
    relatedEntity: input.entity,
    relatedId: input.recordId,
    overrideOptOut: optedOut,
    waUrl,
  });
  if (!queued.ok) return queued;
  if (!queued.value.id) return err('INTERNAL', 'Message was not queued');
  const queuedId = queued.value.id;

  const note = await postMessage(ctx, {
    entity: input.entity,
    recordId: input.recordId,
    body: NOTE_TEXT[ctx.locale](input.channel, to),
    kind: 'note',
  });
  if (!note.ok) return note;

  // A draft quote is marked as sent when the quotation goes out (the order service checks the state).
  if (input.entity === 'sales.order' && input.templateKey === 'quote_sent' && input.channel === 'email') {
    await markOrderSent(ctx, input.recordId);
  }

  await audit(ctx, {
    action: 'send',
    entity: 'messaging.message',
    recordId: queuedId,
    after: { channel: input.channel, templateKey: input.templateKey, relatedEntity: input.entity, relatedId: input.recordId, optedOut },
  });
  return ok({
    id: queuedId,
    state: input.channel === 'email' ? 'queued' : 'manual',
    waUrl,
    optedOut,
    url: link.value.url,
  });
}

// ---------- Log and campaign counts ----------

export interface OutboundRow {
  id: string;
  channel: string;
  toAddress: string;
  subject: string;
  templateKey: string | null;
  relatedEntity: string | null;
  relatedId: string | null;
  state: string;
  attempts: number;
  lastError: string | null;
  sentAt: Date | null;
  createdAt: Date;
  waUrl: string | null;
}

export interface OutboundQuery { state?: string; channel?: string; page: number; pageSize: number }
const MESSAGE_STATES = ['queued', 'sent', 'failed', 'manual'] as const;

export async function listOutboundMessages(ctx: Ctx, q: OutboundQuery): Promise<Result<{ rows: OutboundRow[]; total: number }>> {
  const perm = requirePerm(ctx, LOG_PERM);
  if (!perm.ok) return perm;
  const conditions: SQL[] = [eq(outboundMessages.companyId, ctx.companyId)];
  if (q.state && (MESSAGE_STATES as readonly string[]).includes(q.state)) conditions.push(eq(outboundMessages.state, q.state));
  if (q.channel === 'email' || q.channel === 'whatsapp') conditions.push(eq(outboundMessages.channel, q.channel));
  const where = and(...conditions);
  const pageSize = Math.min(Math.max(1, q.pageSize), 100);
  const page = Math.max(1, q.page);
  const [totalRow] = await ctx.tx.select({ n: count() }).from(outboundMessages).where(where);
  const rows = await ctx.tx
    .select({
      id: outboundMessages.id,
      channel: outboundMessages.channel,
      toAddress: outboundMessages.toAddress,
      subject: outboundMessages.subject,
      templateKey: outboundMessages.templateKey,
      relatedEntity: outboundMessages.relatedEntity,
      relatedId: outboundMessages.relatedId,
      state: outboundMessages.state,
      attempts: outboundMessages.attempts,
      lastError: outboundMessages.lastError,
      sentAt: outboundMessages.sentAt,
      createdAt: outboundMessages.createdAt,
      waUrl: outboundMessages.waUrl,
    })
    .from(outboundMessages)
    .where(where)
    .orderBy(desc(outboundMessages.createdAt), desc(outboundMessages.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return ok({ rows, total: Number(totalRow?.n ?? 0) });
}

/** Sent, failed, manual and queued counts for one campaign. */
export async function campaignDeliveryCounts(ctx: Ctx, campaignId: string): Promise<{ sent: number; failed: number; manual: number; queued: number }> {
  const rows = await ctx.tx
    .select({ state: outboundMessages.state, n: count() })
    .from(outboundMessages)
    .where(and(
      eq(outboundMessages.companyId, ctx.companyId),
      eq(outboundMessages.relatedEntity, 'marketing.campaign'),
      eq(outboundMessages.relatedId, campaignId),
    ))
    .groupBy(outboundMessages.state);
  const out = { sent: 0, failed: 0, manual: 0, queued: 0 };
  for (const r of rows) {
    if (r.state === 'sent') out.sent = Number(r.n);
    else if (r.state === 'failed') out.failed = Number(r.n);
    else if (r.state === 'manual') out.manual = Number(r.n);
    else if (r.state === 'queued') out.queued = Number(r.n);
  }
  return out;
}
