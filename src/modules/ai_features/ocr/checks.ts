/*
 * Pure checks for a scanned vendor bill: duplicates, purchase order suggestions and arithmetic warnings.
 * The service loads the rows and passes them in. Amounts are DZD numbers on the scanned side and cents on the record side.
 */
import { normalizeCode } from './normalize';

export const PO_SOURCE = 'purchases.order';
const AMOUNT_TOLERANCE_CENTS = 100; // 1 DZD
const AMOUNT_TOLERANCE_RATE = 0.005; // 0.5 %
const MAX_PO_CANDIDATES = 3;

export type BillWarning = 'lines_total_mismatch' | 'missing_supplier' | 'missing_number';

export interface ScannedBillLine { quantity: number; unitPrice: number; taxRate: number }

/** Arithmetic and completeness warnings as codes. The UI renders the text. */
export function billWarnings(input: {
  supplierId: string | null;
  number: string | null;
  total: number | null;
  lines: readonly ScannedBillLine[];
}): BillWarning[] {
  const out: BillWarning[] = [];
  if (!input.supplierId) out.push('missing_supplier');
  if (!input.number || input.number.trim() === '') out.push('missing_number');
  if (input.total !== null) {
    const sum = input.lines.reduce((s, l) => s + l.quantity * l.unitPrice * (1 + l.taxRate / 100), 0);
    if (Math.abs(sum - input.total) > 1) out.push('lines_total_mismatch');
  }
  return out;
}

/** What is about to be saved. Built from the final partner, origin, PO link, planned date and planned total. */
export interface BillFingerprint {
  partnerId: string;
  origin: string | null;
  sourceEntity: string | null;
  sourceId: string | null;
  date: string;
  totalCents: bigint;
}

export interface ExistingBill {
  id: string;
  partnerId: string;
  origin: string | null;
  sourceEntity: string | null;
  sourceId: string | null;
  date: string;
  totalCents: bigint;
  state: string;
  number: string | null;
}

export type DuplicateReason = 'origin' | 'purchase_order' | 'date_total';
export interface DuplicateHit { id: string; number: string | null; date: string; totalCents: number; reasons: DuplicateReason[] }

/**
 * Existing vendor bills that look like the same bill. Cancelled bills never count. Same partner is required.
 * A match on the supplier's number, on an already billed purchase order, or on the same date and total.
 */
export function duplicateHits(b: BillFingerprint, existing: readonly ExistingBill[]): DuplicateHit[] {
  const originCode = b.origin ? normalizeCode(b.origin) : '';
  const hits: DuplicateHit[] = [];
  for (const e of existing) {
    if (e.state === 'cancelled' || e.partnerId !== b.partnerId) continue;
    const reasons: DuplicateReason[] = [];
    if (originCode && e.origin && normalizeCode(e.origin) === originCode) reasons.push('origin');
    if (b.sourceEntity === PO_SOURCE && b.sourceId && e.sourceEntity === PO_SOURCE && e.sourceId === b.sourceId) reasons.push('purchase_order');
    if (e.date === b.date && e.totalCents === b.totalCents) reasons.push('date_total');
    if (reasons.length > 0) hits.push({ id: e.id, number: e.number, date: e.date, totalCents: Number(e.totalCents), reasons });
  }
  return hits;
}

export interface OpenOrder { id: string; number: string | null; totalCents: bigint }
export interface PoSuggestion { id: string; number: string; totalCents: number; diffCents: number | null; reason: 'reference' | 'amount' }

/**
 * Open purchase orders that may be this bill. An exact reference match comes first. Otherwise the total must be within
 * max(1 DZD, 0.5 %) of the bill total. Returns at most three.
 */
export function suggestOrders(bill: { poReference: string | null; totalCents: bigint | null }, orders: readonly OpenOrder[]): PoSuggestion[] {
  const ref = bill.poReference ? normalizeCode(bill.poReference) : '';
  const out: (PoSuggestion & { rank: number })[] = [];
  for (const o of orders) {
    if (!o.number) continue;
    const byRef = ref.length > 0 && normalizeCode(o.number) === ref;
    let diff: bigint | null = null;
    let byAmount = false;
    if (bill.totalCents !== null) {
      diff = o.totalCents - bill.totalCents;
      const abs = diff < BigInt(0) ? -diff : diff;
      const tolerance = Math.max(AMOUNT_TOLERANCE_CENTS, Math.round(Number(bill.totalCents) * AMOUNT_TOLERANCE_RATE));
      byAmount = Number(abs) <= tolerance;
    }
    if (!byRef && !byAmount) continue;
    const absDiff = diff === null ? Number.MAX_SAFE_INTEGER : Number(diff < BigInt(0) ? -diff : diff);
    out.push({
      id: o.id,
      number: o.number,
      totalCents: Number(o.totalCents),
      diffCents: diff === null ? null : Number(diff),
      reason: byRef ? 'reference' : 'amount',
      rank: byRef ? 0 : 1 + absDiff,
    });
  }
  return out
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_PO_CANDIDATES)
    .map((c) => ({ id: c.id, number: c.number, totalCents: c.totalCents, diffCents: c.diffCents, reason: c.reason }));
}

export interface ScannedLineForPo { productId: string | null; quantity: number; unitPrice: number }
export interface PoLineForDiff { productId: string | null; quantity: number; unitPriceCents: bigint }
export interface PoLineDiff { lineIndex: number; orderedQty: number; scannedQty: number; orderedUnitCents: number; scannedUnitCents: number }

/** Per-line differences, only for scanned lines whose product is on the purchase order and whose quantity or price differs. */
export function poLineDiffs(lines: readonly ScannedLineForPo[], poLines: readonly PoLineForDiff[]): PoLineDiff[] {
  const out: PoLineDiff[] = [];
  lines.forEach((l, lineIndex) => {
    if (!l.productId) return;
    const po = poLines.find((p) => p.productId === l.productId);
    if (!po) return;
    const scannedUnitCents = Math.round(l.unitPrice * 100);
    const orderedUnitCents = Number(po.unitPriceCents);
    if (po.quantity === l.quantity && orderedUnitCents === scannedUnitCents) return;
    out.push({ lineIndex, orderedQty: po.quantity, scannedQty: l.quantity, orderedUnitCents, scannedUnitCents });
  });
  return out;
}
