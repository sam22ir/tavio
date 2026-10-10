import { and, eq, inArray } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import type { Cents } from '@/core/money';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { partners } from '@/modules/contacts/schema';
import { taxes } from '@/modules/l10n_dz/schema';
import { invoiceLines, invoices } from '../schema';
import { computeTotals, type LineInput } from './math';

export interface NewInvoiceLine {
  productId?: string | null;
  description: string;
  quantity: string;
  unitPriceCents: bigint;
  discountRate?: string | null; // percent 0..100, empty or omitted = 0
  taxId?: string | null;
}
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

/** Validated, computed draft content shared by create and update. Totals come from math.ts only. */
export interface DraftPlan {
  date: string;
  dueDate: string | null;
  untaxedCents: Cents;
  taxCents: Cents;
  lineRows: {
    sequence: number;
    productId: string | null;
    description: string;
    quantity: string;
    unitPriceCents: bigint;
    discountRate: string;
    taxId: string | null;
    taxRate: string;
    subtotalCents: Cents;
    taxCents: Cents;
  }[];
}

const TYPE_PERM = { write: 'invoicing.invoice.write' } as const;
const DAY_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' });
export const today = (): string => DAY_FMT.format(new Date());

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Validates partner, dates, lines and taxes, then computes totals. Writes nothing. */
export async function planDraft(ctx: Ctx, input: NewInvoice): Promise<Result<DraftPlan>> {
  if (input.lines.length === 0) return err('VALIDATION', 'invoice needs at least one line', { field: 'lines' });
  if (input.date && !ISO_DAY.test(input.date)) return err('VALIDATION', 'invalid date', { field: 'date' });
  if (input.dueDate && !ISO_DAY.test(input.dueDate)) return err('VALIDATION', 'invalid due date', { field: 'dueDate' });

  const [partner] = await ctx.tx
    .select({ id: partners.id, isCustomer: partners.isCustomer, isSupplier: partners.isSupplier })
    .from(partners)
    .where(and(eq(partners.companyId, ctx.companyId), eq(partners.id, input.partnerId)));
  if (!partner) return err('NOT_FOUND', 'partner not found', { field: 'partnerId' });
  const isSales = input.type.startsWith('out_');
  if (isSales ? !partner.isCustomer : !partner.isSupplier) {
    return err('VALIDATION', 'partner has the wrong role for this document', { field: 'partnerId' });
  }

  const taxIds = [...new Set(input.lines.map((l) => l.taxId).filter((v): v is string => !!v))];
  const taxRows = taxIds.length
    ? await ctx.tx
        .select({ id: taxes.id, rate: taxes.rate })
        .from(taxes)
        .where(and(eq(taxes.companyId, ctx.companyId), inArray(taxes.id, taxIds)))
    : [];
  const rateById = new Map(taxRows.map((t) => [t.id, String(t.rate)]));

  const lineInputs: LineInput[] = [];
  for (const [i, l] of input.lines.entries()) {
    if (!l.description.trim()) return err('VALIDATION', 'line description required', { field: `lines.${i}.description` });
    const rate = l.taxId ? rateById.get(l.taxId) : '0';
    if (rate === undefined) return err('NOT_FOUND', 'tax not found', { field: `lines.${i}.taxId` });
    lineInputs.push({ quantity: l.quantity, unitPriceCents: l.unitPriceCents, ratePercent: rate ?? '0', discountRate: l.discountRate ?? '0' });
  }
  let totals;
  try {
    totals = computeTotals(lineInputs);
  } catch (e) {
    return err('VALIDATION', (e as Error).message, { field: 'lines' });
  }

  return ok({
    date: input.date ?? today(),
    dueDate: input.dueDate ?? null,
    untaxedCents: totals.untaxedCents,
    taxCents: totals.taxCents,
    lineRows: input.lines.map((l, i) => ({
      sequence: (i + 1) * 10,
      productId: l.productId ?? null,
      description: l.description.trim(),
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      discountRate: lineInputs[i]?.discountRate ?? '0',
      taxId: l.taxId ?? null,
      taxRate: lineInputs[i]?.ratePercent ?? '0',
      subtotalCents: totals.lines[i]!.subtotalCents,
      taxCents: totals.lines[i]!.taxCents,
    })),
  });
}

/** Shared by createInvoice and refunds. Rates are copied from taxes at creation time. */
export async function insertDraft(
  ctx: Ctx,
  input: NewInvoice,
  extra: { refundOfId?: string } = {},
): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, TYPE_PERM.write);
  if (!perm.ok) return perm;
  const plan = await planDraft(ctx, input);
  if (!plan.ok) return plan;
  const { value } = plan;

  const [inv] = await ctx.tx
    .insert(invoices)
    .values({
      companyId: ctx.companyId,
      type: input.type,
      partnerId: input.partnerId,
      state: 'draft',
      date: value.date,
      dueDate: value.dueDate,
      origin: input.origin ?? null,
      sourceEntity: input.sourceEntity ?? null,
      sourceId: input.sourceId ?? null,
      refundOfId: extra.refundOfId ?? null,
      untaxedCents: value.untaxedCents,
      taxCents: value.taxCents,
      stampCents: BigInt(0),
      totalCents: value.untaxedCents + value.taxCents,
      paidCents: BigInt(0),
      paymentState: 'not_paid',
      createdBy: ctx.userId,
    })
    .returning({ id: invoices.id });
  if (!inv) return err('INTERNAL', 'insert failed');

  await ctx.tx.insert(invoiceLines).values(
    value.lineRows.map((r) => ({ ...r, companyId: ctx.companyId, invoiceId: inv.id, createdBy: ctx.userId })),
  );
  await audit(ctx, { entity: 'invoicing.invoice', recordId: inv.id, action: 'create', after: { type: input.type, partnerId: input.partnerId } });
  return ok({ id: inv.id });
}

/** Creates a DRAFT invoice (no number yet). Posting assigns the gap-free number. */
export async function createInvoice(ctx: Ctx, input: NewInvoice): Promise<Result<{ id: string }>> {
  return insertDraft(ctx, input);
}
