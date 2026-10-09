import { and, asc, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import type { ListQuery, ListResult } from '@/core/entities/types';
import { nextNumber } from '@/core/sequences';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { tickets, type Ticket } from '../schema';
import {
  TICKET_CHANNELS,
  TICKET_NUMBER_PADDING,
  TICKET_NUMBER_PREFIX,
  TICKET_PRIORITIES,
  TICKET_STAGES,
  canTransition,
  type TicketStage,
} from './rules';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PAGE_SIZE = 100;
const KANBAN_LIMIT = 200;

const optionalUuid = z.preprocess((v) => (typeof v === 'string' && v.trim() ? v : undefined), z.uuid().optional());
const optionalText = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim() || undefined : v),
  z.string().max(5000).optional(),
);

export const ticketInput = z.object({
  subject: z.string().trim().min(1).max(200),
  channel: z.enum(TICKET_CHANNELS),
  priority: z.enum(TICKET_PRIORITIES).default('normal'),
  partnerId: optionalUuid,
  teamId: optionalUuid,
  description: optionalText,
});
export type TicketInput = z.infer<typeof ticketInput>;

export async function createTicket(ctx: Ctx, input: TicketInput): Promise<Result<{ id: string; number: string }>> {
  const perm = requirePerm(ctx, 'helpdesk.ticket.write');
  if (!perm.ok) return perm;

  const number = await nextNumber(ctx, 'helpdesk.ticket', {
    prefix: TICKET_NUMBER_PREFIX,
    padding: TICKET_NUMBER_PADDING,
  });
  const [row] = await ctx.tx
    .insert(tickets)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      number,
      subject: input.subject,
      channel: input.channel,
      priority: input.priority,
      partnerId: input.partnerId ?? null,
      teamId: input.teamId ?? null,
      description: input.description ?? null,
      stage: 'new',
      assigneeId: null,
    })
    .returning({ id: tickets.id });
  if (!row) return err('INTERNAL', 'Insert failed');

  await audit(ctx, { action: 'create', entity: 'helpdesk.ticket', recordId: row.id, after: { number, subject: input.subject } });
  return ok({ id: row.id, number });
}

export async function getTicket(ctx: Ctx, id: string): Promise<Result<Ticket>> {
  const perm = requirePerm(ctx, 'helpdesk.ticket.read');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(id)) return err('NOT_FOUND', 'Ticket not found');
  const [row] = await ctx.tx
    .select()
    .from(tickets)
    .where(and(eq(tickets.id, id), eq(tickets.companyId, ctx.companyId)))
    .limit(1);
  return row ? ok(row) : err('NOT_FOUND', 'Ticket not found');
}

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function listWhere(ctx: Ctx, query: ListQuery): SQL | undefined {
  const conditions: SQL[] = [eq(tickets.companyId, ctx.companyId)];
  const term = query.q?.trim();
  if (term) {
    const pattern = `%${escapeLike(term)}%`;
    const search = or(ilike(tickets.subject, pattern), ilike(tickets.number, pattern));
    if (search) conditions.push(search);
  }
  const stage = query.filters.stage;
  if (stage && (TICKET_STAGES as readonly string[]).includes(stage)) conditions.push(eq(tickets.stage, stage));
  const channel = query.filters.channel;
  if (channel && (TICKET_CHANNELS as readonly string[]).includes(channel)) conditions.push(eq(tickets.channel, channel));
  const priority = query.filters.priority;
  if (priority && (TICKET_PRIORITIES as readonly string[]).includes(priority)) conditions.push(eq(tickets.priority, priority));
  return and(...conditions);
}

export async function listTickets(ctx: Ctx, query: ListQuery): Promise<Result<ListResult<Ticket>>> {
  const perm = requirePerm(ctx, 'helpdesk.ticket.read');
  if (!perm.ok) return perm;

  const where = listWhere(ctx, query);
  const pageSize = Math.min(Math.max(1, query.pageSize), MAX_PAGE_SIZE);
  const page = Math.max(1, query.page);
  const order = query.dir === 'asc' ? asc(tickets.number) : desc(tickets.number);

  const [totalRow] = await ctx.tx.select({ n: count() }).from(tickets).where(where);
  const rows = await ctx.tx
    .select()
    .from(tickets)
    .where(where)
    .orderBy(order, asc(tickets.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return ok({ rows, total: Number(totalRow?.n ?? 0), page, pageSize });
}

/** Most recent open tickets for the stage Kanban. Capped so the board stays fast. */
export async function listTicketsForBoard(ctx: Ctx): Promise<Result<Ticket[]>> {
  const perm = requirePerm(ctx, 'helpdesk.ticket.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select()
    .from(tickets)
    .where(eq(tickets.companyId, ctx.companyId))
    .orderBy(desc(tickets.createdAt), asc(tickets.id))
    .limit(KANBAN_LIMIT);
  return ok(rows);
}

/** Moves a ticket to another stage if the transition table allows it. */
export async function moveTicketStage(ctx: Ctx, id: string, to: TicketStage): Promise<Result<void>> {
  const perm = requirePerm(ctx, 'helpdesk.ticket.write');
  if (!perm.ok) return perm;

  const [row] = await ctx.tx
    .select()
    .from(tickets)
    .where(and(eq(tickets.id, id), eq(tickets.companyId, ctx.companyId)))
    .for('update');
  if (!row) return err('NOT_FOUND', 'Ticket not found');

  const from = row.stage as TicketStage;
  if (from === to) return ok(undefined);
  if (!canTransition(from, to)) {
    return err('CONFLICT', `Cannot move a ticket from ${from} to ${to}`);
  }

  await ctx.tx.update(tickets).set({ stage: to, updatedAt: new Date() }).where(eq(tickets.id, id));
  await audit(ctx, { action: 'update', entity: 'helpdesk.ticket', recordId: id, before: { stage: from }, after: { stage: to } });
  return ok(undefined);
}

/** Assigns a ticket to a user (or unassigns with null). */
export async function assignTicket(ctx: Ctx, id: string, assigneeId: string | null): Promise<Result<void>> {
  const perm = requirePerm(ctx, 'helpdesk.ticket.write');
  if (!perm.ok) return perm;

  const [row] = await ctx.tx
    .select({ id: tickets.id, assigneeId: tickets.assigneeId })
    .from(tickets)
    .where(and(eq(tickets.id, id), eq(tickets.companyId, ctx.companyId)))
    .for('update');
  if (!row) return err('NOT_FOUND', 'Ticket not found');

  await ctx.tx.update(tickets).set({ assigneeId, updatedAt: new Date() }).where(eq(tickets.id, id));
  await audit(ctx, { action: 'update', entity: 'helpdesk.ticket', recordId: id, before: { assigneeId: row.assigneeId }, after: { assigneeId } });
  return ok(undefined);
}
