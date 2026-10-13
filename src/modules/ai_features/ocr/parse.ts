import { z } from 'zod';
import { parseJsonReply } from '@/core/adapters/ai';
import { err, ok, type Result } from '@/core/result';

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const shortText = (max: number) => z.string().trim().max(max).nullish();

export const ocrBillSchema = z.object({
  supplierName: shortText(200),
  supplierNif: shortText(40),
  supplierNis: shortText(40),
  supplierRc: shortText(40),
  supplierArticle: shortText(40),
  date: isoDay.nullish(),
  /** The supplier's invoice number as printed. Also returned as `number`, which keeps its earlier meaning. */
  number: shortText(100),
  supplierInvoiceNumber: shortText(100),
  poReference: shortText(100),
  lines: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(300),
        quantity: z.number().positive().max(1_000_000),
        unitPrice: z.number().nonnegative().max(1_000_000_000),
        taxRate: z.number().min(0).max(100),
      }),
    )
    .min(1)
    .max(200),
  subtotal: z.number().nonnegative().nullish(),
  taxTotal: z.number().nonnegative().nullish(),
  total: z.number().nonnegative().nullish(),
});

export type OcrBill = z.infer<typeof ocrBillSchema>;

export const OCR_PROMPT = `Extract this vendor invoice. Reply with one JSON object only:
{"supplierName": string|null, "supplierNif": string|null, "supplierNis": string|null, "supplierRc": string|null,
 "supplierArticle": string|null, "date": "YYYY-MM-DD"|null, "number": string|null, "supplierInvoiceNumber": string|null,
 "poReference": string|null, "lines": [{"description": string, "quantity": number, "unitPrice": number, "taxRate": number}],
 "subtotal": number|null, "taxTotal": number|null, "total": number|null}
Rules:
- Bills can mix Arabic and French, and digits can be Arabic-Indic (٠١٢٣٤٥٦٧٨٩). Write every number as ASCII digits in JSON.
- Copy supplierName, supplierNif, supplierNis, supplierRc, supplierArticle, supplierInvoiceNumber and poReference exactly as printed, in their original script.
- supplierNif is the tax identifier (NIF), supplierNis the statistical identifier (NIS), supplierRc the trade register number (RC), supplierArticle the tax article (Article d'imposition).
- poReference is a purchase order number printed on the bill, if any.
- subtotal is the amount before tax (HT), taxTotal the tax amount (TVA), total the amount including tax (TTC).
- Amounts are in DZD without thousands separators. taxRate is a percentage (for example 19). Use null when unreadable.`;

/** Parses and validates the model reply. Malformed or incomplete JSON is an error, never a guess. */
export function parseOcrReply(text: string): Result<OcrBill> {
  const raw = parseJsonReply<unknown>(text);
  if (raw === null) return err('VALIDATION', 'OCR reply is not JSON', { messageKey: 'errors.invalid_bill' });
  const parsed = ocrBillSchema.safeParse(raw);
  if (!parsed.success) return err('VALIDATION', 'OCR reply failed validation', { messageKey: 'errors.invalid_bill' });
  return ok(parsed.data);
}
