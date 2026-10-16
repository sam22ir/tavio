import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { getAi } from '@/core/adapters/ai';
import { assertAiQuota, recordAiUsage } from '@/core/ai/usage';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { partners } from '@/modules/contacts/schema';
import { products } from '@/modules/products/schema';
import { purchaseOrderLines, purchaseOrders } from '@/modules/purchases/schema';
import { taxes } from '@/modules/l10n_dz/schema';
import { invoices } from '@/modules/invoicing/schema';
import { createInvoice, planDraft, type NewInvoiceLine } from '@/modules/invoicing/service/create';
import { uploadFile } from '@/core/files/service';
import { matchProduct, matchSupplier, type SupplierCandidate, type SupplierMatchedBy } from './match';
import { billWarnings, duplicateHits, PO_SOURCE, poLineDiffs, suggestOrders, type BillWarning, type DuplicateHit, type ExistingBill, type PoLineDiff, type PoSuggestion } from './checks';
import { OCR_PROMPT, parseOcrReply, type OcrBill } from './parse';

export const OCR_MAX_BYTES = 5 * 1024 * 1024;
export const OCR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type OcrContentType = (typeof OCR_TYPES)[number];

const PERM = 'ai_features.ocr.use';
const FEATURE = 'ai_features.ocr.extract';
/** Up to 200 lines of JSON plus reasoning tokens. */
const OCR_MAX_TOKENS = 4000;
const OPEN_ORDER_STATES = ['confirmed', 'sent', 'received'] as const;
const CENTS = 100;

export interface ScannedLine {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxId: string | null;
  productId: string | null;
}

export interface PoCandidate extends PoSuggestion { lineDiffs: PoLineDiff[] }

export interface ScanResult {
  supplierId: string | null;
  supplierMatchedBy: SupplierMatchedBy | null;
  supplierCandidates: SupplierCandidate[];
  supplierName: string | null;
  number: string | null;
  poReference: string | null;
  date: string | null;
  subtotal: number | null;
  taxTotal: number | null;
  total: number | null;
  lines: ScannedLine[];
  poCandidates: PoCandidate[];
  duplicates: DuplicateHit[];
  warnings: BillWarning[];
}

/** Reads a vendor bill photo with a vision model and proposes matches. Writes nothing. */
export async function scanVendorBill(
  ctx: Ctx,
  input: { bytes: Uint8Array; contentType: OcrContentType },
): Promise<Result<ScanResult>> {
  const perm = requirePerm(ctx, PERM);
  if (!perm.ok) return perm;
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > OCR_MAX_BYTES) {
    return err('VALIDATION', 'Image must be between 1 byte and 5 MB', { messageKey: 'errors.too_big' });
  }

  const ai = getAi();
  if (!ai || !ai.supportsVision) return err('FORBIDDEN', 'No vision model configured', { messageKey: 'errors.no_vision' });

  const quota = await assertAiQuota(ctx);
  if (!quota.ok) return quota;

  const reply = await ai.complete(
    [
      {
        role: 'user',
        content: [
          { type: 'text', text: OCR_PROMPT },
          { type: 'image', mediaType: input.contentType, dataBase64: Buffer.from(input.bytes).toString('base64') },
        ],
      },
    ],
    { json: true, maxTokens: OCR_MAX_TOKENS, temperature: 0, feature: FEATURE },
  );
  await recordAiUsage(ctx, reply, FEATURE);

  const parsed = parseOcrReply(reply.text);
  if (!parsed.ok) return parsed;
  return ok(await matchBill(ctx, parsed.value));
}

/** DZD amount as integer cents. */
const toCents = (dzd: number): bigint => BigInt(Math.round(dzd * CENTS));

async function matchBill(ctx: Ctx, bill: OcrBill): Promise<ScanResult> {
  const supplierRows = await ctx.tx
    .select({ id: partners.id, name: partners.displayName, nif: partners.nif, nis: partners.nis, rc: partners.rc, article: partners.ai })
    .from(partners)
    .where(and(eq(partners.companyId, ctx.companyId), eq(partners.isSupplier, true), eq(partners.active, true)));
  const productRows = await ctx.tx
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.companyId, ctx.companyId));
  const taxRows = await ctx.tx
    .select({ id: taxes.id, rate: taxes.rate })
    .from(taxes)
    .where(eq(taxes.companyId, ctx.companyId));

  const supplier = matchSupplier(
    {
      supplierName: bill.supplierName,
      supplierNif: bill.supplierNif,
      supplierNis: bill.supplierNis,
      supplierRc: bill.supplierRc,
      supplierArticle: bill.supplierArticle,
    },
    supplierRows,
  );
  const lines: ScannedLine[] = bill.lines.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    taxRate: l.taxRate,
    taxId: taxRows.find((t) => Number(t.rate) === l.taxRate)?.id ?? null,
    productId: matchProduct(l.description, productRows),
  }));

  const number = bill.supplierInvoiceNumber ?? bill.number ?? null;
  const checks = await billChecks(ctx, {
    supplierId: supplier.id,
    number,
    poReference: bill.poReference ?? null,
    date: bill.date ?? null,
    total: bill.total ?? null,
    lines,
  });

  return {
    supplierId: supplier.id,
    supplierMatchedBy: supplier.matchedBy,
    supplierCandidates: supplier.candidates,
    supplierName: bill.supplierName ?? null,
    number,
    poReference: bill.poReference ?? null,
    date: bill.date ?? null,
    subtotal: bill.subtotal ?? null,
    taxTotal: bill.taxTotal ?? null,
    total: bill.total ?? null,
    lines,
    poCandidates: checks.poCandidates,
    duplicates: checks.duplicates,
    warnings: billWarnings({ supplierId: supplier.id, number, total: bill.total ?? null, lines }),
  };
}

export interface BillCheckInput {
  supplierId: string | null;
  number: string | null;
  poReference: string | null;
  date: string | null;
  total: number | null;
  lines: readonly ScannedLine[];
}

/** Purchase order suggestions and duplicate hits for a supplier. Used after a scan and when the user changes the supplier. */
export async function billChecks(
  ctx: Ctx,
  input: BillCheckInput,
): Promise<{ poCandidates: PoCandidate[]; duplicates: DuplicateHit[] }> {
  if (!input.supplierId) return { poCandidates: [], duplicates: [] };
  const totalCents = input.total === null ? null : toCents(input.total);

  const orders = await ctx.tx
    .select({ id: purchaseOrders.id, number: purchaseOrders.number, totalCents: purchaseOrders.totalCents })
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.companyId, ctx.companyId),
        eq(purchaseOrders.partnerId, input.supplierId),
        inArray(purchaseOrders.state, [...OPEN_ORDER_STATES]),
        isNotNull(purchaseOrders.number),
      ),
    );
  const suggestions = suggestOrders({ poReference: input.poReference, totalCents }, orders);

  const poCandidates: PoCandidate[] = [];
  if (suggestions.length > 0) {
    const lineRows = await ctx.tx
      .select({
        orderId: purchaseOrderLines.orderId,
        productId: purchaseOrderLines.productId,
        quantity: purchaseOrderLines.quantity,
        unitPriceCents: purchaseOrderLines.unitPriceCents,
      })
      .from(purchaseOrderLines)
      .where(and(eq(purchaseOrderLines.companyId, ctx.companyId), inArray(purchaseOrderLines.orderId, suggestions.map((s) => s.id))));
    for (const s of suggestions) {
      const rows = lineRows.filter((r) => r.orderId === s.id);
      poCandidates.push({
        ...s,
        lineDiffs: poLineDiffs(
          input.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice })),
          rows.map((r) => ({ productId: r.productId, quantity: Number(r.quantity), unitPriceCents: r.unitPriceCents })),
        ),
      });
    }
  }

  const duplicates = input.total === null || !input.date
    ? []
    : duplicateHits(
        {
          partnerId: input.supplierId,
          origin: input.number,
          sourceEntity: null,
          sourceId: null,
          date: input.date,
          totalCents: toCents(input.total),
        },
        await loadVendorBills(ctx, input.supplierId),
      );

  return { poCandidates, duplicates };
}

/** Vendor bills of one supplier that could be duplicates. Cancelled bills are dropped by the predicate. */
async function loadVendorBills(ctx: Ctx, partnerId: string): Promise<ExistingBill[]> {
  const rows = await ctx.tx
    .select({
      id: invoices.id,
      partnerId: invoices.partnerId,
      origin: invoices.origin,
      sourceEntity: invoices.sourceEntity,
      sourceId: invoices.sourceId,
      date: invoices.date,
      totalCents: invoices.totalCents,
      state: invoices.state,
      number: invoices.number,
    })
    .from(invoices)
    .where(and(eq(invoices.companyId, ctx.companyId), eq(invoices.type, 'in_invoice'), eq(invoices.partnerId, partnerId)))
    .limit(500);
  return rows.map((r) => ({ ...r, totalCents: BigInt(r.totalCents) }));
}

export interface ConfirmBillInput {
  partnerId: string;
  date?: string;
  dueDate?: string;
  origin?: string;
  lines: NewInvoiceLine[];
  fileName: string;
  contentType: OcrContentType;
  bytes: Uint8Array;
  /** Purchase order the bill settles. Must belong to the same supplier and still be open. */
  poId?: string | null;
  /** Set when the user confirmed that a suspected duplicate is a different bill. */
  acknowledgeDuplicate?: boolean;
}

/** Creates the vendor bill as a draft and links the photo. Never posts. */
export async function confirmVendorBill(ctx: Ctx, input: ConfirmBillInput): Promise<Result<{ invoiceId: string }>> {
  const perm = requirePerm(ctx, PERM);
  if (!perm.ok) return perm;

  if (input.poId) {
    const [po] = await ctx.tx
      .select({ partnerId: purchaseOrders.partnerId, state: purchaseOrders.state })
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.companyId, ctx.companyId), eq(purchaseOrders.id, input.poId)));
    if (!po || po.partnerId !== input.partnerId || !(OPEN_ORDER_STATES as readonly string[]).includes(po.state)) {
      return err('VALIDATION', 'purchase order does not match this supplier', { messageKey: 'errors.po_invalid' });
    }
  }

  // The duplicate check uses the values that will be saved: the planned date and total, not the scanned ones.
  const newInvoice = {
    type: 'in_invoice' as const,
    partnerId: input.partnerId,
    date: input.date,
    dueDate: input.dueDate,
    origin: input.origin,
    sourceEntity: input.poId ? PO_SOURCE : undefined,
    sourceId: input.poId ?? undefined,
    lines: input.lines,
  };
  const plan = await planDraft(ctx, newInvoice);
  if (!plan.ok) return plan;
  const totalCents = plan.value.untaxedCents + plan.value.taxCents;
  const hits = duplicateHits(
    {
      partnerId: input.partnerId,
      origin: input.origin ?? null,
      sourceEntity: input.poId ? PO_SOURCE : null,
      sourceId: input.poId ?? null,
      date: plan.value.date,
      totalCents,
    },
    await loadVendorBills(ctx, input.partnerId),
  );
  if (hits.length > 0 && !input.acknowledgeDuplicate) {
    return err('CONFLICT', 'possible duplicate vendor bill', { messageKey: 'errors.duplicate_bill', duplicates: hits.length });
  }

  const created = await createInvoice(ctx, newInvoice);
  if (!created.ok) return created;

  const file = await uploadFile(ctx, {
    entity: 'invoicing.invoice',
    recordId: created.value.id,
    fileName: input.fileName,
    contentType: input.contentType,
    bytes: input.bytes,
    // files_kind_check only allows the kinds in core/db/schema/infra.ts, so the scan is stored as an attachment.
    kind: 'attachment',
  });
  if (!file.ok) return file;

  return ok({ invoiceId: created.value.id });
}
