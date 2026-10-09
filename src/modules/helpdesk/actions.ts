'use server';

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { defineAction, toFormAction } from '@/core/actions/define-action';
import type { FormState } from '@/core/entities/types';
import { err, type Result } from '@/core/result';
import { TICKET_STAGES } from './service/rules';
import { createTeam, teamInput } from './service/teams';
import { createTicket, moveTicketStage, ticketInput } from './service/tickets';

const MODULE = 'helpdesk';

const moveInput = z.object({ id: z.uuid(), stage: z.enum(TICKET_STAGES) });

const createTicketAction = defineAction(
  { perm: 'helpdesk.ticket.write', schema: ticketInput, module: MODULE },
  createTicket,
);
const createTeamAction = defineAction(
  { perm: 'helpdesk.team.write', schema: teamInput, module: MODULE },
  createTeam,
);
const moveAction = defineAction(
  { perm: 'helpdesk.ticket.write', schema: moveInput, module: MODULE },
  (ctx, { id, stage }) => moveTicketStage(ctx, id, stage),
);

/** Form action for /helpdesk/new. */
export async function createTicketForm(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  return toFormAction(createTicketAction, {
    schema: ticketInput,
    redirectTo: ({ id }) => `/${locale}/helpdesk/${id}`,
  })(prev, formData);
}

/** Form action for /helpdesk/teams. */
export async function createTeamForm(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  return toFormAction(createTeamAction, {
    schema: teamInput,
    redirectTo: () => `/${locale}/helpdesk/teams`,
  })(prev, formData);
}

/** Kanban drop handler: moves a ticket to a stage when the transition is allowed. */
export async function moveTicketStageAction(id: string, toColumn: string): Promise<Result<void>> {
  const stage = TICKET_STAGES.find((s) => s === toColumn);
  if (!stage) return err('VALIDATION', 'Unknown stage');
  return moveAction({ id, stage });
}

/** Form action for the stage buttons on the ticket detail page. */
export async function moveTicketStageForm(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const id = String(formData.get('id') ?? '');
  const stage = TICKET_STAGES.find((s) => s === formData.get('stage'));
  if (stage) await moveAction({ id, stage });
  redirect(`/${locale}/helpdesk/${encodeURIComponent(id)}`);
}
