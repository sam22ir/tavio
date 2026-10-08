import type { Locale } from '@/core/ctx';
import { formatDzd } from '@/core/money';

export interface ReminderData { partnerName: string; shopName: string; amountCents: bigint; dueDate: string; contractNumber: string; daysLate: number }

type Templates = {
  dueSoon: (d: ReminderData, amount: string) => string;
  overdue: (d: ReminderData, amount: string) => string;
};

// Heuristic wording only; no legal or credit-bureau meaning.
const TEMPLATES: Record<Locale, Templates> = {
  fr: {
    dueSoon: (d, amount) =>
      `Bonjour ${d.partnerName}, ceci est un rappel courtois de ${d.shopName} : un versement de ${amount} ` +
      `pour le contrat ${d.contractNumber} arrive à échéance le ${d.dueDate}. Merci de votre confiance.`,
    overdue: (d, amount) =>
      `Bonjour ${d.partnerName}, nous vous rappelons que le versement de ${amount} pour le contrat ${d.contractNumber} ` +
      `est en retard de ${d.daysLate} jour(s) (échéance le ${d.dueDate}). Merci de bien vouloir régulariser. ${d.shopName}`,
  },
  ar: {
    dueSoon: (d, amount) =>
      `مرحباً ${d.partnerName}، تذكير من ${d.shopName}: يستحق قسط بقيمة ${amount} ` +
      `للعقد ${d.contractNumber} بتاريخ ${d.dueDate}. شكراً لثقتكم.`,
    overdue: (d, amount) =>
      `مرحباً ${d.partnerName}، نذكركم بأن القسط بقيمة ${amount} للعقد ${d.contractNumber} ` +
      `متأخر منذ ${d.daysLate} يوم (تاريخ الاستحقاق ${d.dueDate}). يرجى التسوية في أقرب وقت. ${d.shopName}`,
  },
  en: {
    dueSoon: (d, amount) =>
      `Hello ${d.partnerName}, a friendly reminder from ${d.shopName}: an installment of ${amount} ` +
      `for contract ${d.contractNumber} is due on ${d.dueDate}. Thank you.`,
    overdue: (d, amount) =>
      `Hello ${d.partnerName}, this is a reminder from ${d.shopName} that the installment of ${amount} ` +
      `for contract ${d.contractNumber} is ${d.daysLate} day(s) overdue (due ${d.dueDate}). Please settle it at your earliest convenience.`,
  },
};

/** Polite reminder text (fr, ar or en) ready for WhatsApp or SMS. */
export function buildReminderMessage(locale: Locale, d: ReminderData): string {
  const amount = formatDzd(d.amountCents, locale);
  const t = TEMPLATES[locale];
  return d.daysLate > 0 ? t.overdue(d, amount) : t.dueSoon(d, amount);
}

/**
 * Normalises an Algerian phone to 213XXXXXXXXX (country code, then 9 digits).
 * Accepts 0[567]XXXXXXXX, +213…, and 00213…. Returns null when unusable.
 */
export function normalizeAlgerianPhone(phone: string | null): string | null {
  if (!phone) return null;
  let p = phone.replace(/[\s.\-()]/g, '');
  if (p.startsWith('+')) {
    p = p.slice(1);
  } else if (p.startsWith('00')) {
    p = p.slice(2);
  } else if (/^0[567]\d{8}$/.test(p)) {
    p = `213${p.slice(1)}`;
  }
  return /^213[567]\d{8}$/.test(p) ? p : null;
}

/** wa.me link with the Algerian number normalised to 213XXXXXXXXX. Returns null if the phone is unusable. */
export function whatsappLink(phone: string | null, text: string): string | null {
  const number = normalizeAlgerianPhone(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
