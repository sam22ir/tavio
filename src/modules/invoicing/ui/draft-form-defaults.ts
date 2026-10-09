// Plain (non-client) types, defaults and totals helpers for the draft line editor. Usable from server pages.
import { formatDzd, type Cents } from '@/core/money';
import { computeTotals, type LineInput } from '../service/math';

export interface DraftLineDraft {
  key: string;
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;   // DZD text, e.g. "1500.50"
  taxId: string;
}

export interface DraftFormInitial {
  id?: string;
  partnerId: string;
  date: string;
  dueDate: string;
  lines: DraftLineDraft[];
}

export interface DraftLookups {
  partners: { value: string; label: string }[];
  products: { value: string; label: string; unitPrice: string; defaultTaxId: string | null }[];
  taxes: { value: string; label: string; rate: string }[];
}

export function newDraftLine(): DraftLineDraft {
  return { key: crypto.randomUUID(), productId: '', description: '', quantity: '1', unitPrice: '', taxId: '' };
}

export function emptyDraftForm(today: string): DraftFormInitial {
  return { partnerId: '', date: today, dueDate: '', lines: [newDraftLine()] };
}

/** Formats integer centimes as DZD text ("1500.50"), the wire format the actions parse. */
export function centsToDzdText(cents: bigint): string {
  const whole = cents / BigInt(100);
  const frac = (cents % BigInt(100)).toString().padStart(2, '0');
  return `${whole.toString()}.${frac}`;
}

/** Parses DZD text to centimes for display only. Returns null for anything the server would reject. */
export function dzdTextToCents(text: string): bigint | null {
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(text.trim().replace(/\s/g, ''));
  if (!m) return null;
  const frac = (m[2] ?? '').padEnd(2, '0');
  return BigInt(m[1] as string) * BigInt(100) + BigInt(frac || '0');
}

export interface DraftPreview { untaxedCents: Cents; taxCents: Cents; totalCents: Cents }

/** Live totals for the editor. Uses the same math as the server. Invalid lines are skipped. */
export function previewDraftTotals(lines: DraftLineDraft[], taxRateById: Map<string, string>): DraftPreview {
  const inputs: LineInput[] = [];
  for (const l of lines) {
    const price = dzdTextToCents(l.unitPrice);
    if (price === null) continue;
    const rate = l.taxId ? (taxRateById.get(l.taxId) ?? '0') : '0';
    inputs.push({ quantity: l.quantity, unitPriceCents: price, ratePercent: rate });
  }
  try {
    const t = computeTotals(inputs);
    return { untaxedCents: t.untaxedCents, taxCents: t.taxCents, totalCents: t.untaxedCents + t.taxCents };
  } catch {
    return { untaxedCents: BigInt(0), taxCents: BigInt(0), totalCents: BigInt(0) };
  }
}

export function formatPreview(cents: Cents, locale: string): string {
  return formatDzd(cents, locale as 'fr' | 'ar' | 'en');
}
