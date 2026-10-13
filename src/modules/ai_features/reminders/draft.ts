import { getAi, parseJsonReply, type AiResult } from '@/core/adapters/ai';
import { assertAiQuota, recordAiUsage } from '@/core/ai/usage';
import type { Ctx, Locale } from '@/core/ctx';
import { formatDzd, type Cents } from '@/core/money';
import { err, ok, type Result } from '@/core/result';
import { getContract } from '@/modules/credit_sales/service/contracts';
import {
  buildReminderMessage,
  whatsappLink,
  type ReminderData,
} from '@/modules/credit_sales/service/reminders';
import {
  buildReminderPrompt,
  validateReminderMessage,
  type ReminderLanguage,
  type ReminderTone,
} from './prompt';

export interface DraftReminderInput {
  contractId: string;
  tone: ReminderTone;
  language: ReminderLanguage;
}

export interface ReminderDraft {
  text: string;
  source: 'ai' | 'template';
  whatsappUrl: string | null;
  amountCents: Cents;
  daysLate: number;
}

const ALGIERS_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Algiers',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function daysLateSince(dueDate: string, now: Date): number {
  const today = Date.parse(ALGIERS_DAY.format(now));
  return Math.max(0, Math.round((today - Date.parse(dueDate)) / 86_400_000));
}

/** Template locale used for the fallback text. Darija falls back to Arabic. */
function templateLocale(language: ReminderLanguage): Locale {
  return language === 'fr' ? 'fr' : 'ar';
}

/**
 * Drafts a WhatsApp reminder for the overdue installments of one contract.
 * Falls back to the template when AI is off, the reply is unusable, or the call fails.
 */
export async function draftReminder(
  ctx: Ctx,
  input: DraftReminderInput,
  shopName: string,
  now: Date = new Date(),
): Promise<Result<ReminderDraft>> {
  const detail = await getContract(ctx, input.contractId);
  if (!detail.ok) return detail;

  const late = detail.value.installments
    .filter((i) => i.status === 'late')
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
  const earliest = late[0];
  if (!earliest) return err('STATE', 'No overdue installment on this contract');

  const amountCents = late.reduce((sum, i) => sum + (i.amountCents - i.paidCents), 0n);
  const data: ReminderData = {
    partnerName: detail.value.partner.name,
    shopName,
    amountCents,
    dueDate: earliest.dueDate,
    contractNumber: detail.value.contract.reference,
    daysLate: daysLateSince(earliest.dueDate, now),
  };
  const locale = templateLocale(input.language);
  const phone = detail.value.partner.phone;
  const template = (): ReminderDraft => {
    const text = buildReminderMessage(locale, data);
    return { text, source: 'template', whatsappUrl: whatsappLink(phone, text), amountCents, daysLate: data.daysLate };
  };

  const ai = getAi();
  if (!ai) return ok(template());

  const quota = await assertAiQuota(ctx);
  if (!quota.ok) return quota;

  const amountText = formatDzd(amountCents, locale);
  const prompt = buildReminderPrompt(data, amountText, input.tone, input.language);
  let result: AiResult;
  try {
    result = await ai.complete(
      [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      { feature: 'credit.reminder_draft', json: true, maxTokens: 300, temperature: 0.4 },
    );
  } catch {
    return ok(template());
  }
  await recordAiUsage(ctx, result, 'credit.reminder_draft');

  const parsed = parseJsonReply<{ message?: unknown }>(result.text);
  const text = validateReminderMessage(parsed?.message, amountText);
  if (!text) return ok(template());
  return ok({ text, source: 'ai', whatsappUrl: whatsappLink(phone, text), amountCents, daysLate: data.daysLate });
}
