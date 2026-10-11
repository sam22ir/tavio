'use server';

import { failureQuery } from '@/ui/feedback/failure-query';
import { queueCampaignEmails } from './service/email';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { defineAction, toFormAction } from '@/core/actions/define-action';
import type { FormState } from '@/core/entities/types';
import {
  buildRecipients,
  campaignInput,
  createCampaign,
  normalizeCampaign,
  setRecipientStatus,
  updateCampaign,
} from './service/campaigns';

const MODULE = 'marketing';
const WRITE = 'marketing.campaign.write';

const updateCampaignInput = campaignInput.extend({ id: z.uuid() });
const buildInput = z.object({ id: z.uuid() });
const statusInput = z.object({
  recipientId: z.uuid(),
  status: z.enum(['pending', 'sent', 'failed']),
});

const createCampaignAction = defineAction(
  { perm: WRITE, schema: campaignInput, module: MODULE },
  async (ctx, input) => {
    const values = normalizeCampaign(input);
    if (!values.ok) return values;
    return createCampaign(ctx, values.value);
  },
);

const updateCampaignAction = defineAction(
  { perm: WRITE, schema: updateCampaignInput, module: MODULE },
  async (ctx, { id, ...input }) => {
    const values = normalizeCampaign(input);
    if (!values.ok) return values;
    return updateCampaign(ctx, id, values.value);
  },
);

const buildRecipientsAction = defineAction(
  { perm: WRITE, schema: buildInput, module: MODULE },
  (ctx, { id }) => buildRecipients(ctx, id, new Date().toISOString().slice(0, 10)),
);

const setStatusAction = defineAction(
  { perm: WRITE, schema: statusInput, module: MODULE },
  (ctx, { recipientId, status }) => setRecipientStatus(ctx, recipientId, status),
);

/** Form action for /marketing/new. */
export async function createCampaignForm(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  return toFormAction(createCampaignAction, {
    schema: campaignInput,
    redirectTo: ({ id }) => `/${locale}/marketing/${id}`,
  })(prev, formData);
}

/** Form action for the editor on /marketing/[id]. The form carries a hidden `id`. */
export async function updateCampaignForm(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  return toFormAction(updateCampaignAction, {
    schema: updateCampaignInput,
    redirectTo: ({ id }) => `/${locale}/marketing/${id}`,
  })(prev, formData);
}

/** Form action for "Build recipients". Redirects back to the campaign either way. */
export async function buildRecipientsForm(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const id = String(formData.get('id') ?? '');
  const r = await buildRecipientsAction({ id });
  redirect(`/${locale}/marketing/${encodeURIComponent(id)}/recipients${failureQuery(r)}`);
}

/** Form action for the per-recipient status buttons. */
export async function setRecipientStatusForm(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const campaignId = String(formData.get('campaignId') ?? '');
  const r = await setStatusAction({
    recipientId: String(formData.get('recipientId') ?? ''),
    status: String(formData.get('status') ?? '') as 'pending' | 'sent' | 'failed',
  });
  redirect(`/${locale}/marketing/${encodeURIComponent(campaignId)}/recipients${failureQuery(r)}`);
}

/** Form action for "Send by email": queues the campaign through the messaging outbox. */
export async function queueCampaignEmailsForm(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const id = String(formData.get('id') ?? '');
  const today = new Date().toISOString().slice(0, 10);
  const r = await queueCampaignEmailsAction({ id, today });
  redirect(`/${locale}/marketing/${encodeURIComponent(id)}${failureQuery(r)}`);
}

const queueCampaignEmailsAction = defineAction(
  { perm: WRITE, schema: z.object({ id: z.uuid(), today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }), module: MODULE },
  (ctx, { id, today }) => queueCampaignEmails(ctx, id, today),
);
