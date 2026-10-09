'use server';

import { failureQuery } from '@/ui/feedback/failure-query';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { defineAction, toFormAction } from '@/core/actions/define-action';
import type { FormState } from '@/core/entities/types';
import { settingsInput, saveSettings } from './service/settings';
import { transitionWebOrder } from './service/orders';
import { convertWebOrderToSale } from './service/convert';

const MODULE = 'website';

const saveSettingsAction = defineAction(
  { perm: 'website.settings.write', schema: settingsInput, module: MODULE },
  saveSettings,
);

const transitionInput = z.object({
  id: z.uuid(),
  action: z.enum(['confirm', 'cancel']),
});

const transitionAction = defineAction(
  { perm: 'website.order.write', schema: transitionInput, module: MODULE },
  (ctx, { id, action }) => transitionWebOrder(ctx, id, action),
);

const convertInput = z.object({ id: z.uuid() });

const convertAction = defineAction(
  { perm: 'website.order.write', schema: convertInput, module: MODULE },
  (ctx, { id }) => convertWebOrderToSale(ctx, id),
);

/** Form action for the storefront settings page. */
export async function saveSettingsForm(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  return toFormAction(saveSettingsAction, {
    schema: settingsInput,
    redirectTo: () => `/${locale}/website`,
  })(prev, formData);
}

/** Admin "Convert" button. Creates a draft sale order, links it, and confirms the web order. */
export async function convertWebOrderForm(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const id = String(formData.get('id') ?? '');
  const r = await convertAction({ id });
  redirect(`/${locale}/website/orders/${encodeURIComponent(id)}${failureQuery(r)}`);
}

/** Admin cancel button for a new web order. */
export async function cancelWebOrderForm(formData: FormData): Promise<void> {
  await runTransition(formData, 'cancel');
}

async function runTransition(formData: FormData, action: 'confirm' | 'cancel'): Promise<void> {
  const locale = await getLocale();
  const id = String(formData.get('id') ?? '');
  const r = await transitionAction({ id, action });
  redirect(`/${locale}/website/orders/${encodeURIComponent(id)}${failureQuery(r)}`);
}
