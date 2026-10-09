import type { ReminderData } from '@/modules/credit_sales/service/reminders';

export type ReminderTone = 'polite' | 'firm';
export type ReminderLanguage = 'fr' | 'ar' | 'darija';

export const REMINDER_MAX_CHARS = 400;

const LANGUAGE_NAME: Record<ReminderLanguage, string> = {
  fr: 'French',
  ar: 'Modern Standard Arabic (Arabic script)',
  darija: 'Algerian Darija written in Arabic script (not Latin letters)',
};

const TONE_GUIDE: Record<ReminderTone, string> = {
  polite: 'warm, courteous and respectful',
  firm: 'clear and direct about the deadline, but still respectful',
};

/** Blocks wording that threatens or pressures the customer. Checked on the AI reply. */
const THREAT_PATTERN =
  /tribunal|police|prison|huissier|avocat|justice|lawsuit|court|arrest|sue|saisie|سجن|محكمة|شرطة|محامي|قضائ/i;

export function buildReminderPrompt(
  data: ReminderData,
  amountText: string,
  tone: ReminderTone,
  language: ReminderLanguage,
): { system: string; user: string } {
  const system =
    'You write short WhatsApp payment reminders for a small Algerian shop. ' +
    'Reply only with a JSON object of the form {"message": "..."}. ' +
    `The message must be at most ${REMINDER_MAX_CHARS} characters, in ${LANGUAGE_NAME[language]}. ` +
    'Never threaten, never mention lawyers, courts or police, and never add greetings beyond one short opening.';
  const user = [
    `Tone: ${TONE_GUIDE[tone]}.`,
    `Customer: ${data.partnerName}.`,
    `Shop name: ${data.shopName}.`,
    `Amount due: ${amountText}.`,
    `Contract: ${data.contractNumber}.`,
    `Due date: ${data.dueDate}.`,
    data.daysLate > 0 ? `Days late: ${data.daysLate}.` : 'Not yet late.',
    'Include the amount and the shop name.',
  ].join('\n');
  return { system, user };
}

/** Returns the trimmed message when it is usable, otherwise null. */
export function validateReminderMessage(raw: unknown, amountDigitsSource: string): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (text.length === 0 || text.length > REMINDER_MAX_CHARS) return null;
  if (THREAT_PATTERN.test(text)) return null;
  // Compare the whole-dinar part only, so "1 400,00 DA" matches "1400 DA".
  const digits = (s: string) => s.replace(/[,.]\d{1,2}\b.*$/, '').replace(/\D/g, '');
  const wanted = digits(amountDigitsSource);
  if (wanted.length > 0 && !digits(text).includes(wanted)) return null;
  return text;
}
