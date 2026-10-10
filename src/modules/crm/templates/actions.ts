'use server';

import { getLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
import { applyMourabahaTemplate } from './apply-mourabaha';

const applyMourabahaDefined = defineAction(
  { perm: 'crm.lead.write', schema: z.object({}), module: 'crm' },
  (ctx) => applyMourabahaTemplate(ctx),
);

/**
 * Form action for the "Apply Mourabaha template" button. Gated by crm.lead.write.
 * Redirects back to the CRM teams page with the outcome and any skipped steps.
 */
export async function applyMourabahaAction(): Promise<void> {
  const locale = await getLocale();
  const result = await applyMourabahaDefined({});
  if (!result.ok) redirect(`/${locale}/crm/teams?template=failed`);
  const skipped = result.value.skipped.join(',');
  const query = skipped ? `template=applied&skipped=${skipped}` : 'template=applied';
  redirect(`/${locale}/crm/teams?${query}`);
}
