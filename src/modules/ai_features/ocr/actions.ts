'use server';

import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
import { parseDzd } from '@/core/money';
import { err, ok } from '@/core/result';
import { billChecks, confirmVendorBill, OCR_TYPES, scanVendorBill } from './service';

const base64Image = z.string().min(1).max(7_000_000); // about 5 MB decoded
const contentType = z.enum(OCR_TYPES);

/** Decodes base64 and enforces the byte limit in the service. */
function decode(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

export const scanVendorBillAction = defineAction(
  {
    perm: 'ai_features.ocr.use',
    schema: z.object({ contentType, dataBase64: base64Image }),
  },
  (ctx, input) => scanVendorBill(ctx, { bytes: decode(input.dataBase64), contentType: input.contentType }),
);

const reviewLine = z.object({
  productId: z.uuid().nullable(),
  description: z.string().trim().min(1).max(300),
  quantity: z.string().regex(/^\d+(\.\d{1,3})?$/),
  unitPrice: z.string().min(1),
  taxId: z.uuid().nullable(),
});

const dayString = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
);

export const confirmVendorBillAction = defineAction(
  {
    perm: 'ai_features.ocr.use',
    schema: z.object({
      partnerId: z.uuid(),
      date: dayString,
      dueDate: dayString,
      origin: z.string().trim().max(100).optional(),
      lines: z.array(reviewLine).min(1).max(200),
      fileName: z.string().trim().min(1).max(200),
      contentType,
      dataBase64: base64Image,
      poId: z.uuid().nullable().optional(),
      acknowledgeDuplicate: z.boolean(),
    }),
  },
  async (ctx, input) => {
    const bytes = decode(input.dataBase64);
    const lines = [];
    for (const l of input.lines) {
      const price = parseDzd(l.unitPrice);
      if (price === null) return err('VALIDATION', 'invalid amount', { messageKey: 'errors.invalid_amount' });
      lines.push({ productId: l.productId, description: l.description, quantity: l.quantity, unitPriceCents: price, taxId: l.taxId });
    }
    const res = await confirmVendorBill(ctx, {
      partnerId: input.partnerId,
      date: input.date,
      dueDate: input.dueDate,
      origin: input.origin,
      lines,
      fileName: input.fileName,
      contentType: input.contentType,
      bytes,
      poId: input.poId ?? null,
      acknowledgeDuplicate: input.acknowledgeDuplicate,
    });
    return res.ok ? ok(res.value) : res;
  },
);

/** Re-runs the PO and duplicate checks when the user changes the supplier or the bill fields. */
export const checkVendorBillAction = defineAction(
  {
    perm: 'ai_features.ocr.use',
    schema: z.object({
      supplierId: z.uuid().nullable(),
      number: z.string().trim().max(100).nullable(),
      poReference: z.string().trim().max(100).nullable(),
      date: dayString,
      total: z.number().nonnegative().nullable(),
      lines: z.array(z.object({ productId: z.uuid().nullable(), quantity: z.number().positive(), unitPrice: z.number().nonnegative(), taxRate: z.number() })).max(200),
    }),
  },
  async (ctx, input) =>
    ok(
      await billChecks(ctx, {
        supplierId: input.supplierId,
        number: input.number,
        poReference: input.poReference,
        date: input.date ?? null,
        total: input.total,
        lines: input.lines.map((l) => ({ ...l, description: '', taxId: null })),
      }),
    ),
);
