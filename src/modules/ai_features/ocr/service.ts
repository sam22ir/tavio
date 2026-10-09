import { and, eq } from 'drizzle-orm';
import { getAi } from '@/core/adapters/ai';
import { assertAiQuota, recordAiUsage } from '@/core/ai/usage';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { partners } from '@/modules/contacts/schema';
import { products } from '@/modules/products/schema';
import { taxes } from '@/modules/l10n_dz/schema';
import { createInvoice, type NewInvoiceLine } from '@/modules/invoicing/service/create';
import { uploadFile } from '@/core/files/service';
import { matchProduct, matchSupplier } from './match';
import { OCR_PROMPT, parseOcrReply, type OcrBill } from './parse';

export const OCR_MAX_BYTES = 5 * 1024 * 1024;
export const OCR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type OcrContentType = (typeof OCR_TYPES)[number];

const PERM = 'ai_features.ocr.use';
const FEATURE = 'ai_features.ocr.extract';

export interface ScannedLine {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxId: string | null;
  productId: string | null;
}

export interface ScanResult {
  supplierId: string | null;
  supplierName: string | null;
  number: string | null;
  date: string | null;
  total: number | null;
  lines: ScannedLine[];
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
    { json: true, maxTokens: 1500, temperature: 0, feature: FEATURE },
  );
  await recordAiUsage(ctx, reply, FEATURE);

  const parsed = parseOcrReply(reply.text);
  if (!parsed.ok) return parsed;
  return ok(await matchBill(ctx, parsed.value));
}

async function matchBill(ctx: Ctx, bill: OcrBill): Promise<ScanResult> {
  const supplierRows = await ctx.tx
    .select({ id: partners.id, nif: partners.nif, name: partners.displayName })
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

  const supplierId = matchSupplier(bill, supplierRows);
  const lines: ScannedLine[] = bill.lines.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    taxRate: l.taxRate,
    taxId: taxRows.find((t) => Number(t.rate) === l.taxRate)?.id ?? null,
    productId: matchProduct(l.description, productRows),
  }));

  return {
    supplierId,
    supplierName: bill.supplierName ?? null,
    number: bill.number ?? null,
    date: bill.date ?? null,
    total: bill.total ?? null,
    lines,
  };
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
}

/** Creates the vendor bill as a draft and links the photo. Never posts. */
export async function confirmVendorBill(ctx: Ctx, input: ConfirmBillInput): Promise<Result<{ invoiceId: string }>> {
  const perm = requirePerm(ctx, PERM);
  if (!perm.ok) return perm;

  const created = await createInvoice(ctx, {
    type: 'in_invoice',
    partnerId: input.partnerId,
    date: input.date,
    dueDate: input.dueDate,
    origin: input.origin,
    lines: input.lines,
  });
  if (!created.ok) return created;

  const file = await uploadFile(ctx, {
    entity: 'invoicing.invoice',
    recordId: created.value.id,
    fileName: input.fileName,
    contentType: input.contentType,
    bytes: input.bytes,
    kind: 'vendor_bill_scan',
  });
  if (!file.ok) return file;

  return ok({ invoiceId: created.value.id });
}
