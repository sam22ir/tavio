'use server';

import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { defineAction, toFormAction } from '@/core/actions/define-action';
import type { FormState } from '@/core/entities/types';
import { parseDzd } from '@/core/money';
import * as crm from '@/modules/crm/service';

const emptyToUndef = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const optText = (max: number) => z.preprocess(emptyToUndef, z.string().trim().max(max).optional());
const optUuid = z.preprocess(emptyToUndef, z.string().uuid().optional());
const optNumber = z.preprocess(
  emptyToUndef,
  z.coerce.number().int().min(0).max(100).optional(),
);
const dzdCents = z.preprocess(emptyToUndef, z.string().optional()).transform((v, c) => {
  if (v === undefined) return undefined;
  const cents = parseDzd(v);
  if (cents === null) {
    c.addIssue({ code: 'custom', message: 'Invalid amount', path: [] });
    return z.NEVER;
  }
  return cents;
});

const leadInput = z.object({
  type: z.enum(['lead', 'opportunity']).default('lead'),
  name: z.string().trim().min(1, 'Required').max(200),
  partnerId: optUuid,
  contactName: optText(200),
  phone: optText(40),
  email: optText(200),
  wilayaCode: optText(10),
  source: z.preprocess(
    emptyToUndef,
    z.enum(['walk_in', 'phone', 'facebook', 'instagram', 'whatsapp', 'referral', 'other']).optional(),
  ),
  stageId: z.string().uuid(),
  probability: optNumber,
  expectedRevenueCents: dzdCents,
  expectedCloseDate: z.preprocess(emptyToUndef, z.string().date().optional()),
  salespersonId: optUuid,
  priority: z.preprocess(emptyToUndef, z.enum(['0', '1']).optional()),
});

const leadUpdateInput = leadInput.extend({ id: z.string().uuid() });
const idInput = z.object({ id: z.string().uuid() });
const moveInput = z.object({ id: z.string().uuid(), stageId: z.string().uuid() });
const lostInput = z.object({
  id: z.string().uuid(),
  lostReasonId: optUuid,
  note: optText(1000),
});

const createLeadDefined = defineAction(
  { perm: 'crm.lead.write', schema: leadInput, module: 'crm' },
  (ctx, input) => crm.createLead(ctx, input),
);

const updateLeadDefined = defineAction(
  { perm: 'crm.lead.write', schema: leadUpdateInput, module: 'crm' },
  (ctx, { id, ...rest }) => crm.updateLead(ctx, id, rest),
);

const moveLeadDefined = defineAction(
  { perm: 'crm.lead.write', schema: moveInput, module: 'crm' },
  (ctx, input) => crm.moveLead(ctx, input.id, input.stageId),
);

const markWonDefined = defineAction({ perm: 'crm.lead.write', schema: idInput, module: 'crm' }, async (ctx, input) => {
  const pipeline = await crm.ensureDefaultPipeline(ctx);
  if (!pipeline.ok) return pipeline;
  const stages = await crm.listStages(ctx, pipeline.value.id);
  if (!stages.ok) return stages;
  const won = stages.value.find((s) => s.isWon);
  if (!won) return { ok: false, error: { code: 'INTERNAL', message: 'No won stage configured' } };
  return crm.moveLead(ctx, input.id, won.id);
});

const markLostDefined = defineAction(
  { perm: 'crm.lead.write', schema: lostInput, module: 'crm' },
  (ctx, input) => crm.markLost(ctx, input.id, input.lostReasonId, input.note),
);

const reopenLeadDefined = defineAction(
  { perm: 'crm.lead.write', schema: idInput, module: 'crm' },
  (ctx, input) => crm.reopenLead(ctx, input.id),
);

function refresh() {
  revalidatePath('/', 'layout');
}

export async function createLeadFormAction(prev: FormState, fd: FormData): Promise<FormState> {
  const locale = await getLocale();
  return toFormAction(createLeadDefined, {
    schema: leadInput,
    redirectTo: (v) => `/${locale}/crm/${(v as { id: string }).id}`,
  })(prev, fd);
}

export async function updateLeadFormAction(prev: FormState, fd: FormData): Promise<FormState> {
  const result = await toFormAction(updateLeadDefined, { schema: leadUpdateInput })(prev, fd);
  if (result.ok) refresh();
  return result;
}

export async function moveLeadAction(input: { id: string; stageId: string }) {
  const result = await moveLeadDefined(input);
  if (result.ok) refresh();
  return result;
}

export async function markWonAction(input: { id: string }) {
  const result = await markWonDefined(input);
  if (result.ok) refresh();
  return result;
}

export async function markLostAction(input: { id: string; lostReasonId?: string; note?: string }) {
  const result = await markLostDefined(input);
  if (result.ok) refresh();
  return result;
}

export async function reopenLeadAction(input: { id: string }) {
  const result = await reopenLeadDefined(input);
  if (result.ok) refresh();
  return result;
}
