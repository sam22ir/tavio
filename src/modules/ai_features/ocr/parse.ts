import { z } from 'zod';
import { parseJsonReply } from '@/core/adapters/ai';
import { err, ok, type Result } from '@/core/result';

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const ocrBillSchema = z.object({
  supplierName: z.string().trim().max(200).nullish(),
  supplierNif: z.string().trim().max(40).nullish(),
  date: isoDay.nullish(),
  number: z.string().trim().max(100).nullish(),
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
  total: z.number().nonnegative().nullish(),
});

export type OcrBill = z.infer<typeof ocrBillSchema>;

export const OCR_PROMPT = `Extract this vendor invoice. Reply with one JSON object only:
{"supplierName": string|null, "supplierNif": string|null, "date": "YYYY-MM-DD"|null, "number": string|null,
 "lines": [{"description": string, "quantity": number, "unitPrice": number, "taxRate": number}], "total": number|null}
Amounts are in DZD without thousands separators. taxRate is a percentage (for example 19). Use null when unreadable.`;

/** Parses and validates the model reply. Malformed or incomplete JSON is an error, never a guess. */
export function parseOcrReply(text: string): Result<OcrBill> {
  const raw = parseJsonReply<unknown>(text);
  if (raw === null) return err('VALIDATION', 'OCR reply is not JSON', { messageKey: 'errors.invalid_bill' });
  const parsed = ocrBillSchema.safeParse(raw);
  if (!parsed.success) return err('VALIDATION', 'OCR reply failed validation', { messageKey: 'errors.invalid_bill' });
  return ok(parsed.data);
}
