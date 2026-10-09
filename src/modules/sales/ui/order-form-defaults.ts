// Plain (non-client) form types and defaults, usable from server pages.

export interface OrderLineDraft {
  key: string;
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  taxId: string;
}

export interface OrderFormInitial {
  id?: string;
  partnerId: string;
  orderDate: string;
  validityDate: string;
  note: string;
  lines: OrderLineDraft[];
}

export function newLine(): OrderLineDraft {
  return { key: crypto.randomUUID(), productId: '', description: '', quantity: '1', unitPrice: '', discount: '0', taxId: '' };
}

export function emptyOrderForm(today: string): OrderFormInitial {
  return { partnerId: '', orderDate: today, validityDate: '', note: '', lines: [newLine()] };
}

// Quotation form with editable lines. Totals are computed on the server; the server validates again.
