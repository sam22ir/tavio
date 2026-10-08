// STUB owned by W4-N.
import type { Locale } from '@/core/ctx';
export interface ReminderData { partnerName: string; shopName: string; amountCents: bigint; dueDate: string; contractNumber: string; daysLate: number }
/** Polite reminder text (fr, ar or en) ready for WhatsApp or SMS. */
export function buildReminderMessage(_locale: Locale, _d: ReminderData): string { throw new Error('not implemented'); }
/** wa.me link with the Algerian number normalised to 213XXXXXXXXX. Returns null if the phone is unusable. */
export function whatsappLink(_phone: string | null, _text: string): string | null { throw new Error('not implemented'); }
