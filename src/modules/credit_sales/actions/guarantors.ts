'use server';

import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
import type { Result } from '@/core/result';
import { addGuarantor, removeGuarantor, updateGuarantor, type GuarantorInput, type IdDocumentInput } from '../service/guarantors';

const idSchema = z.string().uuid();
const idDocumentSchema = z.object({
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(1).max(100),
  bytes: z.instanceof(Uint8Array),
});
const guarantorSchema = z.object({
  fullName: z.string(),
  nin: z.string(),
  phone: z.string().max(30).optional(),
  address: z.string().max(300).optional(),
  relation: z.string().max(60).optional(),
  idDocument: idDocumentSchema.nullable().optional(),
});

const addAction = defineAction(
  { perm: 'credit_sales.contract.write', schema: guarantorSchema.extend({ contractId: z.string().uuid() }), module: 'credit_sales' },
  (ctx, input) => {
    const { contractId, ...rest } = input;
    return addGuarantor(ctx, contractId, rest as GuarantorInput);
  },
);
const updateAction = defineAction(
  { perm: 'credit_sales.contract.write', schema: guarantorSchema.extend({ id: z.string().uuid() }), module: 'credit_sales' },
  (ctx, input) => {
    const { id, ...rest } = input;
    return updateGuarantor(ctx, id, rest as GuarantorInput);
  },
);
const removeAction = defineAction(
  { perm: 'credit_sales.contract.write', schema: z.object({ id: idSchema }), module: 'credit_sales' },
  (ctx, input) => removeGuarantor(ctx, input.id),
);

/** Reads the guarantor form. The ID document is optional; an empty file input is ignored. */
async function readGuarantorForm(formData: FormData): Promise<Record<string, unknown>> {
  const text = (key: string): string | undefined => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : undefined;
  };
  const file = formData.get('idDocument');
  let idDocument: IdDocumentInput | null = null;
  if (file instanceof File && file.size > 0) {
    idDocument = { fileName: file.name, contentType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) };
  }
  return {
    fullName: text('fullName') ?? '',
    nin: text('nin') ?? '',
    phone: text('phone'),
    address: text('address'),
    relation: text('relation'),
    idDocument,
  };
}

/** Server action wrappers for the guarantor form. Each returns a Result and never throws. */
export async function addGuarantorForm(contractId: string, formData: FormData): Promise<Result<{ id: string }>> {
  return addAction({ ...(await readGuarantorForm(formData)), contractId } as Parameters<typeof addAction>[0]);
}
export async function updateGuarantorForm(id: string, formData: FormData): Promise<Result<{ id: string }>> {
  return updateAction({ ...(await readGuarantorForm(formData)), id } as Parameters<typeof updateAction>[0]);
}
export async function removeGuarantorById(id: string): Promise<Result<{ id: string }>> {
  return removeAction({ id });
}
