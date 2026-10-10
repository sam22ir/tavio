'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
import { applyMourabahaTemplate } from './apply-mourabaha';

const applyMourabahaDefined = defineAction(
  { perm: 'crm.lead.write', schema: z.object({}), module: 'crm' },
  (ctx) => applyMourabahaTemplate(ctx),
);

/** Form action for the "Apply Mourabaha template" button. Gated by crm.lead.write. */
export async function applyMourabahaAction(): Promise<void> {
  const result = await applyMourabahaDefined({});
  if (result.ok) revalidatePath('/', 'layout');
}
