'use server';

import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
import type { Ctx } from '@/core/ctx';
import { requireUser } from '@/core/auth/session';
import { listMyCompanies } from '@/core/tenancy/service';
import { confirm, reject } from '../actions/service';
import { askAssistant } from './service';

const PERM = 'ai_features.assistant.use';

export const askAssistantAction = defineAction(
  {
    perm: PERM,
    schema: z.object({ question: z.string().trim().min(3).max(500) }),
  },
  (ctx, input) => askAssistant(ctx, input.question),
);

/** Company display name for reminder text. Empty when the user is no longer a member. */
async function shopNameOf(ctx: Ctx): Promise<string> {
  const user = await requireUser();
  if (!user.ok) return '';
  const companies = await listMyCompanies(user.value.userId);
  return companies.find((c) => c.id === ctx.companyId)?.name ?? '';
}

const actionIdSchema = z.object({ actionId: z.string().uuid() });

/** Runs a proposed action. Returns ok with state 'failed' when the work was stale or invalid. */
export const confirmAiAction = defineAction(
  { perm: PERM, schema: actionIdSchema },
  async (ctx, input) => confirm(ctx, input.actionId, await shopNameOf(ctx)),
);

export const rejectAiAction = defineAction(
  { perm: PERM, schema: actionIdSchema },
  (ctx, input) => reject(ctx, input.actionId),
);
