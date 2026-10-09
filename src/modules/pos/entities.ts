import { z } from 'zod';

// Zod input schemas for POS actions. Money arrives as a DZD decimal string and is parsed with core/money.
export const moneyText = z.string().regex(/^\d+(?:[.,]\d{1,2})?$/);
export const quantityText = z.string().regex(/^\d+(?:\.\d{1,3})?$/);

export const openSessionInput = z.object({ openingCash: moneyText });
export const closeSessionInput = z.object({ sessionId: z.uuid(), closingCash: moneyText });
export const payOrderInput = z.object({
  sessionId: z.uuid(),
  method: z.enum(['cash', 'cib', 'edahabia']),
  partnerId: z.uuid().optional(),
  tendered: moneyText.optional(),
  lines: z
    .array(z.object({ productId: z.uuid(), quantity: quantityText }))
    .min(1)
    .max(200),
});
