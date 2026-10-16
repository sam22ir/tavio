/** Pure matching helpers. The service loads candidates from the tenant and passes them in. */
import { digitsOnly, normalizeCode, normalizeName, normalizeText, nameTokens } from './normalize';

export interface PartnerCandidate {
  id: string;
  name: string;
  nif: string | null;
  nis: string | null;
  rc: string | null;
  /** Tax article (Article d'imposition), stored in partners.ai. */
  article: string | null;
}
export interface ProductCandidate { id: string; name: string }

export type SupplierMatchedBy = 'nif' | 'nis' | 'rc' | 'article' | 'name';
export interface SupplierCandidate { id: string; name: string; score: number }
/** `id` is set only for an automatic match. Anything ambiguous or fuzzy comes back as `candidates` for the user to pick. */
export interface SupplierMatch { id: string | null; matchedBy: SupplierMatchedBy | null; candidates: SupplierCandidate[] }

export interface BillIdentity {
  supplierName?: string | null;
  supplierNif?: string | null;
  supplierNis?: string | null;
  supplierRc?: string | null;
  supplierArticle?: string | null;
}

/** Fuzzy name similarity needed before a name is offered as a candidate. Never auto-selects. */
export const FUZZY_THRESHOLD = 0.6;
export const MAX_SUPPLIER_CANDIDATES = 3;

const NIF_MIN_DIGITS = 8;

/** Dice coefficient over token sets: 2 * shared / (sizeA + sizeB). */
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(nameTokens(a));
  const tb = new Set(nameTokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return (2 * shared) / (ta.size + tb.size);
}

type IdKey = { by: SupplierMatchedBy; partner: (p: PartnerCandidate) => string | null; key: (s: string) => string; minLength: number };

const ID_LEVELS: IdKey[] = [
  { by: 'nif', partner: (p) => p.nif, key: digitsOnly, minLength: NIF_MIN_DIGITS },
  { by: 'nis', partner: (p) => p.nis, key: normalizeCode, minLength: 1 },
  { by: 'rc', partner: (p) => p.rc, key: normalizeCode, minLength: 1 },
  { by: 'article', partner: (p) => p.article, key: normalizeCode, minLength: 1 },
];

/**
 * Supplier matching, in order: NIF, NIS, RC, article, exact normalised name. An identifier or exact name that
 * hits exactly one partner auto-selects. Several hits, or a fuzzy name match, only return candidates.
 */
export function matchSupplier(bill: BillIdentity, partners: readonly PartnerCandidate[]): SupplierMatch {
  const billIds: Record<SupplierMatchedBy, string | null | undefined> = {
    nif: bill.supplierNif,
    nis: bill.supplierNis,
    rc: bill.supplierRc,
    article: bill.supplierArticle,
    name: undefined,
  };

  for (const level of ID_LEVELS) {
    const raw = billIds[level.by];
    const key = raw ? level.key(raw) : '';
    if (key.length < level.minLength) continue;
    const hits = partners.filter((p) => {
      const v = level.partner(p);
      return v !== null && level.key(v) === key;
    });
    const picked = hits.length === 1 ? hits[0] : undefined;
    if (picked) return { id: picked.id, matchedBy: level.by, candidates: [] };
    if (hits.length > 1) return { id: null, matchedBy: null, candidates: hits.slice(0, MAX_SUPPLIER_CANDIDATES).map((p) => ({ id: p.id, name: p.name, score: 1 })) };
  }

  const name = bill.supplierName ? normalizeName(bill.supplierName) : '';
  if (name) {
    const hits = partners.filter((p) => normalizeName(p.name) === name);
    const picked = hits.length === 1 ? hits[0] : undefined;
    if (picked) return { id: picked.id, matchedBy: 'name', candidates: [] };
    if (hits.length > 1) return { id: null, matchedBy: null, candidates: hits.slice(0, MAX_SUPPLIER_CANDIDATES).map((p) => ({ id: p.id, name: p.name, score: 1 })) };

    const fuzzy = partners
      .map((p) => ({ id: p.id, name: p.name, score: nameSimilarity(name, p.name) }))
      .filter((c) => c.score >= FUZZY_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SUPPLIER_CANDIDATES);
    return { id: null, matchedBy: null, candidates: fuzzy };
  }

  return { id: null, matchedBy: null, candidates: [] };
}

/** Matches a line description to a product name, case-insensitive contains in either direction. Short strings never match. */
export function matchProduct(description: string, products: readonly ProductCandidate[]): string | null {
  const d = normalizeText(description);
  if (d.length < 3) return null;
  const hit = products.find((p) => {
    const n = normalizeText(p.name);
    return n.length >= 3 && (n.includes(d) || d.includes(n));
  });
  return hit?.id ?? null;
}
