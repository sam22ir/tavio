'use server';

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { defineAction, toFormAction } from '@/core/actions/define-action';
import type { FormState } from '@/core/entities/types';
import {
  archivePartner,
  createPartner,
  partnerInput,
  partnerOptions,
  updatePartner,
} from './service/partners';

const MODULE = 'contacts';
const WRITE = 'contacts.partner.write';
const READ = 'contacts.partner.read';

const updatePartnerInput = partnerInput.extend({ id: z.uuid() });
const archiveInput = z.object({ id: z.uuid() });
const optionsInput = z.object({ search: z.string().max(100).optional() });

const createPartnerAction = defineAction(
  { perm: WRITE, schema: partnerInput, module: MODULE },
  createPartner,
);

const updatePartnerAction = defineAction(
  { perm: WRITE, schema: updatePartnerInput, module: MODULE },
  (ctx, { id, ...input }) => updatePartner(ctx, id, input),
);

const archivePartnerAction = defineAction(
  { perm: WRITE, schema: archiveInput, module: MODULE },
  (ctx, { id }) => archivePartner(ctx, id),
);

const partnerOptionsAction = defineAction(
  { perm: READ, schema: optionsInput, module: MODULE },
  (ctx, { search }) => partnerOptions(ctx, search),
);

/** Form action for /contacts/new. */
export async function createPartnerForm(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  return toFormAction(createPartnerAction, {
    schema: partnerInput,
    redirectTo: ({ id }) => `/${locale}/contacts/${id}`,
  })(prev, formData);
}

/** Form action for the edit tab on /contacts/[id]. The form carries a hidden `id`. */
export async function updatePartnerForm(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  return toFormAction(updatePartnerAction, {
    schema: updatePartnerInput,
    redirectTo: ({ id }) => `/${locale}/contacts/${id}`,
  })(prev, formData);
}

/** Form action for the archive button. */
export async function archivePartnerForm(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const id = String(formData.get('id') ?? '');
  const result = await archivePartnerAction({ id });
  redirect(result.ok ? `/${locale}/contacts` : `/${locale}/contacts/${encodeURIComponent(id)}`);
}

/** Active partners for selects in other modules. */
export async function searchPartnerOptions(
  search?: string,
): Promise<{ value: string; label: string }[]> {
  const result = await partnerOptionsAction({ search });
  return result.ok ? result.value : [];
}
