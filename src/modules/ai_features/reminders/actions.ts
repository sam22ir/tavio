'use server';

import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
import { getActiveCompanyId } from '@/core/tenancy/active';
import { listMyCompanies } from '@/core/tenancy/service';
import { requireUser } from '@/core/auth/session';
import { err, type Result } from '@/core/result';
import { draftReminder as draftReminderService, type ReminderDraft } from './draft';

const schema = z.object({
  contractId: z.string().uuid(),
  tone: z.enum(['polite', 'firm']),
  language: z.enum(['fr', 'ar', 'darija']),
});

export const draftReminder = defineAction(
  { perm: 'credit_sales.contract.read', schema },
  async (ctx, input): Promise<Result<ReminderDraft>> => {
    const user = await requireUser();
    if (!user.ok) return err('UNAUTHENTICATED', 'Not signed in');
    const companies = await listMyCompanies(user.value.userId);
    const stored = await getActiveCompanyId();
    const company = companies.find((c) => c.id === stored) ?? companies.find((c) => c.id === ctx.companyId);
    return draftReminderService(ctx, input, company?.name ?? '');
  },
);
