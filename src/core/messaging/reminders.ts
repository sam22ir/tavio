import { and, eq, gte, lte, sql } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { companies } from '@/core/db/schema/tenancy';
import { formatDzd } from '@/core/money';
import { issuePortalToken } from '@/core/portal/links';
import { readPortalBaseUrl, readPortalSecret } from '@/core/portal/env';
import { portalTokenUrl } from '@/core/portal/tokens';
import { messageOptOuts } from '@/core/db/schema/messaging';
import { creditContracts, creditInstallments } from '@/modules/credit_sales/schema';
import { partners } from '@/modules/contacts/schema';
import { buildUnsubscribeUrl, type UnsubscribePayload } from './unsubscribe';
import { queueMessage } from './outbox';
import { effectiveTemplate, getMessageSettings, type MessageSettingsValues } from './service';
import { messageLocaleFor, renderMessage, textToHtml, withUnsubscribe, type TemplateKey } from './template';

export interface ReminderCandidate {
  contractId: string;
  contractRef: string;
  installmentId: string;
  dueDate: string;
  remainingCents: bigint;
  partnerId: string;
  partnerName: string;
  partnerEmail: string | null;
}

export interface PlannedReminder {
  candidate: ReminderCandidate;
  templateKey: Extract<TemplateKey, 'installment_reminder_before' | 'installment_overdue'>;
  /** Days relative to the due date: the "before" offset, or the days late. */
  offset: number;
  dedupeKey: string;
}

const MS_PER_DAY = 86_400_000;

/** Whole days from one ISO date (yyyy-mm-dd) to another, in UTC arithmetic so DST cannot shift it. */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / MS_PER_DAY);
}

/** Today's date in Africa/Algiers as yyyy-mm-dd. */
export function todayAlgiersIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Dedupe key: one reminder per contract, installment, template and offset, ever. */
export function reminderDedupeKey(contractId: string, installmentId: string, templateKey: string, offset: number): string {
  return `reminder:${contractId}:${installmentId}:${templateKey}:${offset}`;
}

/**
 * Pure: which reminders are due today. "Before" fires when the due date is exactly beforeDays ahead,
 * "overdue" when the installment is exactly one of the overdueDays late.
 */
export function planReminders(rows: readonly ReminderCandidate[], settings: MessageSettingsValues, today: string): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  for (const candidate of rows) {
    if (!candidate.partnerEmail) continue; // partners without an email keep the activity / wa.me flow
    const untilDue = daysBetween(today, candidate.dueDate);
    if (untilDue === settings.beforeDays) {
      planned.push({
        candidate,
        templateKey: 'installment_reminder_before',
        offset: settings.beforeDays,
        dedupeKey: reminderDedupeKey(candidate.contractId, candidate.installmentId, 'installment_reminder_before', settings.beforeDays),
      });
    }
    const late = -untilDue;
    if (late > 0 && settings.overdueDays.includes(late)) {
      planned.push({
        candidate,
        templateKey: 'installment_overdue',
        offset: late,
        dedupeKey: reminderDedupeKey(candidate.contractId, candidate.installmentId, 'installment_overdue', late),
      });
    }
  }
  return planned;
}

/** Pure: splits a plan into reminders to send and reminders skipped because the partner opted out of email. */
export function partitionByOptOut(plan: readonly PlannedReminder[], optedOut: ReadonlySet<string>): { send: PlannedReminder[]; optedOut: PlannedReminder[] } {
  const send: PlannedReminder[] = [];
  const skipped: PlannedReminder[] = [];
  for (const item of plan) {
    if (optedOut.has(item.candidate.partnerId)) skipped.push(item);
    else send.push(item);
  }
  return { send, optedOut: skipped };
}

export interface ReminderRunResult { planned: number; queued: number; duplicates: number; optedOut: number; skipped: number }

/**
 * Queues the automatic reminder emails for one company. Off by default (message_settings.reminders_enabled).
 * Skips opted-out partners, partners without email (they keep the activity flow) and duplicates (dedupe key).
 * Runs inside the daily cron transaction for the company (ctx.tx).
 */
export async function queueInstallmentReminders(ctx: Ctx, today = todayAlgiersIso()): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { planned: 0, queued: 0, duplicates: 0, optedOut: 0, skipped: 0 };
  const settings = await getMessageSettings(ctx);
  if (!settings.remindersEnabled) return result;

  const maxLate = Math.max(0, ...settings.overdueDays);
  const from = addDaysIso(today, -maxLate);
  const to = addDaysIso(today, settings.beforeDays);
  const rows = await ctx.tx
    .select({
      contractId: creditContracts.id,
      contractRef: creditContracts.reference,
      installmentId: creditInstallments.id,
      dueDate: creditInstallments.dueDate,
      amountCents: creditInstallments.amountCents,
      paidCents: creditInstallments.paidCents,
      partnerId: partners.id,
      partnerName: partners.displayName,
      partnerEmail: partners.email,
    })
    .from(creditInstallments)
    .innerJoin(creditContracts, and(eq(creditContracts.id, creditInstallments.contractId), eq(creditContracts.companyId, ctx.companyId)))
    .innerJoin(partners, and(eq(partners.id, creditContracts.partnerId), eq(partners.companyId, ctx.companyId)))
    .where(and(
      eq(creditInstallments.companyId, ctx.companyId),
      eq(creditContracts.state, 'active'),
      sql`${creditInstallments.paidCents} < ${creditInstallments.amountCents}`,
      gte(creditInstallments.dueDate, from),
      lte(creditInstallments.dueDate, to),
    ));

  const candidates: ReminderCandidate[] = rows.map((r) => ({
    contractId: r.contractId,
    contractRef: r.contractRef,
    installmentId: r.installmentId,
    dueDate: r.dueDate,
    remainingCents: BigInt(r.amountCents) - BigInt(r.paidCents),
    partnerId: r.partnerId,
    partnerName: r.partnerName,
    partnerEmail: r.partnerEmail,
  }));
  const plan0 = planReminders(candidates, settings, today);
  result.planned = plan0.length;
  if (plan0.length === 0) return result;
  const optedOutIds = new Set(
    (await ctx.tx
      .select({ partnerId: messageOptOuts.partnerId })
      .from(messageOptOuts)
      .where(and(eq(messageOptOuts.companyId, ctx.companyId), eq(messageOptOuts.channel, 'email')))).map((r) => r.partnerId),
  );
  const { send: plan, optedOut: skippedOptOut } = partitionByOptOut(plan0, optedOutIds);
  result.optedOut = skippedOptOut.length;

  const base = readPortalBaseUrl();
  const secret = readPortalSecret();
  if (!base || !secret) {
    result.skipped = plan.length; // no public origin or secret: no link and no unsubscribe link, so nothing is sent
    return result;
  }

  const [company] = await ctx.tx.select({ name: companies.displayName, locale: companies.defaultLocale }).from(companies).where(eq(companies.id, ctx.companyId));
  const locale = messageLocaleFor(company?.locale ?? 'fr');
  const copy = await effectiveTemplate(ctx, 'installment_reminder_before', locale);

  for (const item of plan) {
    const issued = await issuePortalToken(ctx.tx, {
      companyId: ctx.companyId,
      partnerId: item.candidate.partnerId,
      purpose: 'document',
      target: { entity: 'credit_sales.contract', id: item.candidate.contractId },
      createdBy: null,
    });
    const link = portalTokenUrl(base, locale, issued.token);
    const unsub = await buildUnsubscribeUrl(base, { c: ctx.companyId, p: item.candidate.partnerId, ch: 'email' } satisfies UnsubscribePayload, secret);
    const templateCopy = item.templateKey === 'installment_reminder_before'
      ? copy
      : await effectiveTemplate(ctx, 'installment_overdue', locale);
    const vars = {
      partner: item.candidate.partnerName,
      company: company?.name ?? '',
      number: item.candidate.contractRef,
      amount: formatDzd(item.candidate.remainingCents, locale),
      due_date: item.candidate.dueDate,
      days: item.offset,
    };
    const rendered = renderMessage(templateCopy, { ...vars });
    const text = rendered.text.replaceAll('{link}', link);
    const withFooter = withUnsubscribe({ subject: rendered.subject, text, html: textToHtml(text) }, unsub, locale);
    const q = await queueMessage(ctx, {
      channel: 'email',
      to: item.candidate.partnerEmail as string,
      subject: withFooter.subject,
      html: withFooter.html,
      text: withFooter.text,
      partnerId: item.candidate.partnerId,
      templateKey: item.templateKey,
      relatedEntity: 'credit_sales.contract',
      relatedId: item.candidate.contractId,
      dedupeKey: item.dedupeKey,
    });
    if (!q.ok) {
      result.skipped += 1;
      continue;
    }
    if (q.value.duplicate) result.duplicates += 1;
    else result.queued += 1;
  }
  return result;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
