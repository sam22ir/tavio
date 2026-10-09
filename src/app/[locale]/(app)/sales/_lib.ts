import type { OrderLineDraft } from '@/modules/sales/ui/order-form';

// Cents to the DZD text the form uses, e.g. 150050 -> "1500,50".
export function centsToInput(cents: bigint): string {
  const whole = cents / BigInt(100);
  const frac = (cents % BigInt(100)).toString().padStart(2, '0');
  return `${whole.toString()},${frac}`;
}

export function todayAlgiers(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function toDraftLines(rows: { productId: unknown; description: unknown; quantity: unknown; unitPriceCents: unknown; discountRate: unknown; taxId: unknown }[], keyPrefix: string): OrderLineDraft[] {
  return rows.map((r, i) => ({
    key: `${keyPrefix}-${i}`,
    productId: typeof r.productId === 'string' ? r.productId : '',
    description: String(r.description ?? ''),
    quantity: String(r.quantity ?? '1'),
    unitPrice: centsToInput(BigInt(String(r.unitPriceCents ?? '0'))),
    discount: String(Number(r.discountRate ?? 0)),
    taxId: typeof r.taxId === 'string' ? r.taxId : '',
  }));
}
