/** Pure matching helpers. The service loads candidates from the tenant and passes them in. */

export interface PartnerCandidate { id: string; nif: string | null; name: string }
export interface ProductCandidate { id: string; name: string }

const digits = (s: string): string => s.replace(/\D/g, '');
const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Matches by NIF (digits only) first, then by case-insensitive exact name. */
export function matchSupplier(
  bill: { supplierNif?: string | null; supplierName?: string | null },
  partners: readonly PartnerCandidate[],
): string | null {
  const nif = bill.supplierNif ? digits(bill.supplierNif) : '';
  if (nif.length >= 8) {
    const byNif = partners.find((p) => p.nif && digits(p.nif) === nif);
    if (byNif) return byNif.id;
  }
  const name = bill.supplierName ? norm(bill.supplierName) : '';
  if (name) {
    const byName = partners.find((p) => norm(p.name) === name);
    if (byName) return byName.id;
  }
  return null;
}

/** Matches a line description to a product name, case-insensitive contains in either direction. Short strings never match. */
export function matchProduct(description: string, products: readonly ProductCandidate[]): string | null {
  const d = norm(description);
  if (d.length < 3) return null;
  const hit = products.find((p) => {
    const n = norm(p.name);
    return n.length >= 3 && (n.includes(d) || d.includes(n));
  });
  return hit?.id ?? null;
}
