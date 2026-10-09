// STUB owned by W5-B. Used by sales (invoice from order) and purchases (vendor bill from PO).
import type { Ctx } from '@/core/ctx';
import type { Result } from '@/core/result';
export interface NewInvoiceLine { productId?: string | null; description: string; quantity: string; unitPriceCents: bigint; taxId?: string | null }
export interface NewInvoice {
  type: 'out_invoice' | 'out_refund' | 'in_invoice' | 'in_refund';
  partnerId: string;
  date?: string;             // YYYY-MM-DD, default today (Africa/Algiers)
  dueDate?: string;
  origin?: string;           // e.g. sale order or PO number
  sourceEntity?: string;     // e.g. 'sales.order'
  sourceId?: string;
  lines: NewInvoiceLine[];
}
/** Creates a DRAFT invoice (no number yet). Posting assigns the gap-free number. */
export async function createInvoice(_ctx: Ctx, _input: NewInvoice): Promise<Result<{ id: string }>> { throw new Error('not implemented'); }
