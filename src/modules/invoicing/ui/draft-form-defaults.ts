// Plain (non-client) types, defaults and totals helpers for the draft line editor. Usable from server pages.
import { formatDzd, type Cents } from '@/core/money';
import { computeTotals, withholdingOn, type LineInput } from '../service/math';

export interface DraftLineDraft {
  key: string;
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;   // DZD text, e.g. "1500.50"
  discount: string;    // percent text, e.g. "10"; empty = 0
  taxId: string;
}

export interface DraftFormInitial {
  id?: string;
  partnerId: string;
  date: string;
  dueDate: string;
  /** Vendor bills: the retenue à la source tax, or empty for none. */
  withholdingTaxId?: string;
  lines: DraftLineDraft[];
}

export interface DraftLookups {
  partners: { value: string; label: string }[];
  products: { value: string; label: string; unitPrice: string; defaultTaxId: string | null }[];
  taxes: { value: string; label: string; rate: string }[];
  withholdingTaxes: { value: string; label: string; rate: string }[];
}

export function newDraftLine(): DraftLineDraft {
  return { key: crypto.randomUUID(), productId: '', description: '', quantity: '1', unitPrice: '', discount: '', taxId: '' };
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

export interface DraftPreview { untaxedCents: Cents; taxCents: Cents; totalCents: Cents; withholdingCents: Cents; netPayableCents: Cents }

/** Live totals for the editor. Uses the same math as the server. Invalid lines are skipped. */
export function previewDraftTotals(lines: DraftLineDraft[], taxRateById: Map<string, string>, withholdingRate = '0'): DraftPreview {
  const inputs: LineInput[] = [];
  for (const l of lines) {
    const price = dzdTextToCents(l.unitPrice);
    if (price === null) continue;
    const rate = l.taxId ? (taxRateById.get(l.taxId) ?? '0') : '0';
    inputs.push({ quantity: l.quantity, unitPriceCents: price, ratePercent: rate, discountRate: l.discount || '0' });
  }
  try {
    const t = computeTotals(inputs);
    const totalCents = t.untaxedCents + t.taxCents;
    const withholdingCents = withholdingOn(t.untaxedCents, withholdingRate);
    return { untaxedCents: t.untaxedCents, taxCents: t.taxCents, totalCents, withholdingCents, netPayableCents: totalCents - withholdingCents };
  } catch {
    return { untaxedCents: BigInt(0), taxCents: BigInt(0), totalCents: BigInt(0), withholdingCents: BigInt(0), netPayableCents: BigInt(0) };
  }
}

export function formatPreview(cents: Cents, locale: string): string {
  return formatDzd(cents, locale as 'fr' | 'ar' | 'en');
}
