// Pure planning for purchase orders created from a source document (W13-PO).
// Groups source lines by the preferred supplier of their product. Lines without a supplier are skipped.

export interface SplitLine {
  lineNo: number;
  productId: string | null;
}

export interface SupplierChoice {
  productId: string;
  partnerId: string;
  sequence: number;
}

export interface SupplierGroup {
  partnerId: string;
  lineNos: number[];
}

export interface SupplierSplit {
  groups: SupplierGroup[];
  skippedLineNos: number[];
}

/**
 * Picks the supplier with the lowest sequence per product (ties broken by partner id), then groups lines by supplier.
 * Groups keep the order of their first line. Each line appears once.
 */
export function splitBySupplier(lines: readonly SplitLine[], suppliers: readonly SupplierChoice[]): SupplierSplit {
  const preferred = new Map<string, SupplierChoice>();
  for (const s of suppliers) {
    const current = preferred.get(s.productId);
    if (
      !current ||
      s.sequence < current.sequence ||
      (s.sequence === current.sequence && s.partnerId < current.partnerId)
    ) {
      preferred.set(s.productId, s);
    }
  }

  const groups = new Map<string, number[]>();
  const skippedLineNos: number[] = [];
  for (const line of lines) {
    const supplier = line.productId === null ? undefined : preferred.get(line.productId);
    if (!supplier) {
      skippedLineNos.push(line.lineNo);
      continue;
    }
    const bucket = groups.get(supplier.partnerId);
    if (bucket) bucket.push(line.lineNo);
    else groups.set(supplier.partnerId, [line.lineNo]);
  }

  return {
    groups: [...groups.entries()].map(([partnerId, lineNos]) => ({ partnerId, lineNos })),
    skippedLineNos,
  };
}
