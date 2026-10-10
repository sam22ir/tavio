import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { Ctx } from '@/core/ctx';
import { audit } from '@/core/audit';
import { emit } from '@/core/events';
import type { Tx } from '@/core/db/types';
import type { ListQuery, ListResult } from '@/core/entities/types';
import { requirePerm } from '@/core/perms';
import { nextNumber } from '@/core/sequences';
import { err, ok, type AppError, type Result } from '@/core/result';
import { partners } from '@/modules/contacts/schema';
import { createDraftContract, type DraftContractInput } from '@/modules/credit_sales/service/contracts';
import { postMessage } from '@/modules/chatter/service';
import { activities } from '@/modules/chatter/schema';
import { leads, lostReasons, stages } from '../schema';
import { ensureDefaultPipeline } from './pipeline';
import { LEAD_CHANNELS } from './lead-constants';
import { leadScope, teamIdForUser } from './teams';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Form values arrive as '' for empty inputs. Treat them as absent.
const blank = (v: unknown): unknown => (v === '' || v === null ? undefined : v);
const text = (max: number) => z.preprocess(blank, z.string().trim().max(max).optional());
const uuid = z.preprocess(blank, z.string().regex(UUID_RE).optional());

export const leadInput = z.object({
  type: z.enum(['lead', 'opportunity']).default('lead'),
  name: z.string().trim().min(1).max(200),
  partnerId: uuid,
  contactName: text(200),
  phone: text(32),
  email: text(254),
  wilayaCode: z.preprocess(blank, z.string().regex(/^(0[1-9]|[1-4][0-9]|5[0-8])$/).optional()),
  source: z.preprocess(
    blank,
    z.enum(['walk_in', 'phone', 'facebook', 'instagram', 'whatsapp', 'referral', 'other']).optional(),
  ),
  channel: z.preprocess(blank, z.enum(LEAD_CHANNELS).optional()),
  stageId: uuid,
  // Optional. Defaults to the stage's pipeline, or the default pipeline when no stage is given.
  pipelineId: uuid,
  probability: z.preprocess(blank, z.coerce.number().int().min(0).max(100).optional()),
  expectedRevenueCents: z.preprocess(blank, z.bigint().nonnegative().optional()),
  expectedCloseDate: z.preprocess(blank, z.iso.date().optional()),
  salespersonId: uuid,
  priority: z.preprocess(blank, z.coerce.number().int().min(0).max(1).optional()),
});
export type LeadInput = z.input<typeof leadInput>;
export type LeadData = z.output<typeof leadInput>;

export const leadUpdateInput = leadInput.omit({ stageId: true, pipelineId: true }).partial();
export type LeadUpdateInput = z.input<typeof leadUpdateInput>;

export type LeadRow = {
  id: string;
  reference: string | null;
  type: string;
  name: string;
  status: string;
  probability: number;
  stageId: string;
  stageName: string;
  partnerId: string | null;
  partnerName: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  wilayaCode: string | null;
  source: string | null;
  expectedCents: bigint | null;
  expectedCloseDate: string | null;
  salespersonId: string | null;
  salespersonName: string | null;
  teamId: string | null;
  teamName: string | null;
  priority: number;
  nextActivityDate: string | null;
  channel: string | null;
  attemptCount: number;
  daysInStage: number;
  active: boolean;
  wonAt: Date | null;
  convertedContractId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const leadColumns = {
  id: leads.id,
  reference: leads.reference,
  type: leads.type,
  name: leads.name,
  status: leads.status,
  probability: leads.probability,
  stageId: leads.stageId,
  stageName: stages.name,
  partnerId: leads.partnerId,
  partnerName: partners.displayName,
  partnerIdLabel: partners.displayName,
  contactName: leads.contactName,
  phone: leads.phone,
  email: leads.email,
  wilayaCode: leads.wilayaCode,
  source: leads.source,
  expectedCents: leads.expectedRevenueCents,
  expectedRevenueCents: leads.expectedRevenueCents,
  expectedCloseDate: leads.expectedCloseDate,
  salespersonId: leads.salespersonId,
  // users is revoked from tavio_app; the tenant-scoped member_directory view carries the name.
  salespersonName: sql<string | null>`(select md.name from member_directory md where md.company_id = ${leads.companyId} and md.user_id = ${leads.salespersonId})`,
  teamId: leads.teamId,
  // sales_teams is tenant-scoped; the join is on the lead's own company.
  teamName: sql<string | null>`(select st.name from sales_teams st where st.company_id = ${leads.companyId} and st.id = ${leads.teamId})`,
  priority: leads.priority,
  nextActivityDate: activities.dueDate,
  channel: leads.channel,
  attemptCount: leads.attemptCount,
  daysInStage: sql<number>`greatest(0, floor(extract(epoch from (now() - ${leads.stageEnteredAt})) / 86400))::int`,
  active: leads.active,
  wonAt: leads.wonAt,
  convertedContractId: leads.convertedContractId,
  createdAt: leads.createdAt,
  updatedAt: leads.updatedAt,
};

function leadQuery(tx: Tx) {
  return tx
    .select(leadColumns)
    .from(leads)
    .innerJoin(stages, eq(stages.id, leads.stageId))
    .leftJoin(partners, eq(partners.id, leads.partnerId))
    .leftJoin(activities, eq(activities.id, leads.nextActivityId));
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const FILTER_COLUMNS = {
  type: leads.type,
  source: leads.source,
  status: leads.status,
  wilayaCode: leads.wilayaCode,
  stageId: leads.stageId,
  salespersonId: leads.salespersonId,
  partnerId: leads.partnerId,
  teamId: leads.teamId,
} as const;
const UUID_FILTERS = new Set<string>(['stageId', 'salespersonId', 'partnerId', 'teamId']);

const SORT_COLUMNS = {
  createdAt: leads.createdAt,
  name: leads.name,
  status: leads.status,
  probability: leads.probability,
  expectedRevenueCents: leads.expectedRevenueCents,
  expectedCloseDate: leads.expectedCloseDate,
  priority: leads.priority,
} as const;

/** Paged leads. Archived leads are hidden unless the filter `active=false` is given. */
export async function listLeads(ctx: Ctx, q: ListQuery): Promise<Result<ListResult<LeadRow>>> {
  const perm = requirePerm(ctx, 'crm.lead.read');
  if (!perm.ok) return perm;

  const conds: SQL[] = [
    eq(leads.companyId, ctx.companyId),
    eq(leads.active, q.filters.active !== 'false'),
  ];
  const scope = await leadScope(ctx);
  if (scope) conds.push(scope);
  if (q.filters.pipelineId) conds.push(eq(leads.pipelineId, q.filters.pipelineId));

  if (q.q) {
    const like = `%${escapeLike(q.q)}%`;
    const search = or(
      ilike(leads.name, like),
      ilike(leads.reference, like),
      ilike(leads.contactName, like),
      ilike(leads.phone, like),
      ilike(leads.email, like),
      ilike(partners.displayName, like),
    );
    if (search) conds.push(search);
  }

  for (const [name, value] of Object.entries(q.filters)) {
    if (name === 'active') continue;
    if (!(name in FILTER_COLUMNS)) continue;
    if (UUID_FILTERS.has(name) && !UUID_RE.test(value)) {
      return err('VALIDATION', `Invalid ${name} filter`);
    }
    const column = FILTER_COLUMNS[name as keyof typeof FILTER_COLUMNS];
    conds.push(eq(column, value));
  }

  const where = and(...conds);
  const sortColumn = q.sort && q.sort in SORT_COLUMNS ? SORT_COLUMNS[q.sort as keyof typeof SORT_COLUMNS] : leads.createdAt;
  const order = q.dir === 'asc' ? asc(sortColumn) : desc(sortColumn);

  const rows = await leadQuery(ctx.tx)
    .where(where)
    .orderBy(order)
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize);

  const [totalRow] = await ctx.tx
    .select({ n: count() })
    .from(leads)
    .leftJoin(partners, eq(partners.id, leads.partnerId))
    .where(where);

  return ok({ rows, total: totalRow?.n ?? 0, page: q.page, pageSize: q.pageSize });
}

/** Active leads of one pipeline, grouped by stage in position order (for the kanban). */
export async function leadsByStage(
  ctx: Ctx,
  pipelineId: string,
  opts: { teamId?: string } = {},
): Promise<Result<{ stage: { id: string; name: string; position: number; probability: number; isWon: boolean; requirements: string | null }; leads: LeadRow[] }[]>> {
  const perm = requirePerm(ctx, 'crm.lead.read');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(pipelineId)) return err('VALIDATION', 'Invalid pipeline id');
  if (opts.teamId !== undefined && !UUID_RE.test(opts.teamId)) return err('VALIDATION', 'Invalid team id');

  const stageRows = await ctx.tx
    .select({
      id: stages.id,
      name: stages.name,
      position: stages.position,
      probability: stages.probability,
      isWon: stages.isWon,
      requirements: stages.requirements,
    })
    .from(stages)
    .where(and(eq(stages.companyId, ctx.companyId), eq(stages.pipelineId, pipelineId)))
    .orderBy(asc(stages.position));

  const scope = await leadScope(ctx);
  const leadRows = await leadQuery(ctx.tx)
    .where(
      and(
        eq(leads.companyId, ctx.companyId),
        eq(leads.pipelineId, pipelineId),
        eq(leads.active, true),
        scope,
        opts.teamId ? eq(leads.teamId, opts.teamId) : undefined,
      ),
    )
    .orderBy(desc(leads.updatedAt));

  return ok(
    stageRows.map((stage) => ({
      stage,
      leads: leadRows.filter((l) => l.stageId === stage.id),
    })),
  );
}

/** Number of active leads the user may see, optionally narrowed by extra conditions (for dashboards). */
export async function scopedLeadCount(ctx: Ctx, extraWhere?: SQL): Promise<Result<number>> {
  const perm = requirePerm(ctx, 'crm.lead.read');
  if (!perm.ok) return perm;
  const scope = await leadScope(ctx);
  const [row] = await ctx.tx
    .select({ n: count() })
    .from(leads)
    .where(and(eq(leads.companyId, ctx.companyId), eq(leads.active, true), scope, extraWhere));
  return ok(row?.n ?? 0);
}

export async function getLead(ctx: Ctx, id: string): Promise<Result<LeadRow>> {
  const perm = requirePerm(ctx, 'crm.lead.read');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(id)) return err('NOT_FOUND', 'Lead not found');
  const scope = await leadScope(ctx);
  const [row] = await leadQuery(ctx.tx).where(and(eq(leads.companyId, ctx.companyId), eq(leads.id, id), scope));
  if (!row) return err('NOT_FOUND', 'Lead not found');
  return ok(row);
}

// Locks the lead row for the rest of the transaction.
// Every lead mutation loads the lead through the visibility scope, so an out-of-scope lead is NOT_FOUND.
async function lockLead(ctx: Ctx, id: string) {
  const scope = await leadScope(ctx);
  const [row] = await ctx.tx
    .select()
    .from(leads)
    .where(and(eq(leads.companyId, ctx.companyId), eq(leads.id, id), scope))
    .for('update');
  return row;
}

async function loadStage(ctx: Ctx, stageId: string) {
  const [row] = await ctx.tx
    .select()
    .from(stages)
    .where(and(eq(stages.companyId, ctx.companyId), eq(stages.id, stageId)));
  return row;
}

async function partnerExists(ctx: Ctx, partnerId: string): Promise<boolean> {
  const [row] = await ctx.tx
    .select({ id: partners.id })
    .from(partners)
    .where(and(eq(partners.companyId, ctx.companyId), eq(partners.id, partnerId)));
  return Boolean(row);
}

export async function createLead(
  ctx: Ctx,
  input: LeadInput,
): Promise<Result<{ id: string; reference: string | null }>> {
  const perm = requirePerm(ctx, 'crm.lead.write');
  if (!perm.ok) return perm;
  const parsed = leadInput.safeParse(input);
  if (!parsed.success) return err('VALIDATION', 'Invalid lead', { fields: parsed.error.issues.map((i) => i.path.join('.')) });
  const data = parsed.data;

  // With a stage, the lead goes to that stage's pipeline. Without one, it starts at the first stage of
  // the requested pipeline, or of the default pipeline when none is requested.
  let stage: Awaited<ReturnType<typeof loadStage>>;
  if (data.stageId) {
    stage = await loadStage(ctx, data.stageId);
  } else {
    let pipelineId = data.pipelineId;
    if (!pipelineId) {
      const pipeline = await ensureDefaultPipeline(ctx);
      if (!pipeline.ok) return pipeline;
      pipelineId = pipeline.value.id;
    }
    const [first] = await ctx.tx
      .select()
      .from(stages)
      .where(and(eq(stages.companyId, ctx.companyId), eq(stages.pipelineId, pipelineId)))
      .orderBy(asc(stages.position))
      .limit(1);
    stage = first;
  }
  if (!stage) return err('VALIDATION', 'Unknown stage');
  if (data.pipelineId && stage.pipelineId !== data.pipelineId) return err('VALIDATION', 'Stage belongs to another pipeline');

  if (data.partnerId && !(await partnerExists(ctx, data.partnerId))) {
    return err('NOT_FOUND', 'Partner not found');
  }

  const reference = await nextNumber(ctx, 'lead', { prefix: 'LEAD-{YYYY}-', padding: 5 });
  const [row] = await ctx.tx
    .insert(leads)
    .values({
      companyId: ctx.companyId,
      reference,
      type: data.type,
      name: data.name,
      partnerId: data.partnerId,
      contactName: data.contactName,
      phone: data.phone,
      email: data.email,
      wilayaCode: data.wilayaCode,
      source: data.source,
      channel: data.channel,
      pipelineId: stage.pipelineId,
      stageId: stage.id,
      stageEnteredAt: new Date(),
      status: 'open',
      probability: data.probability ?? stage.probability,
      expectedRevenueCents: data.expectedRevenueCents,
      expectedCloseDate: data.expectedCloseDate,
      salespersonId: data.salespersonId,
      teamId: data.salespersonId ? await teamIdForUser(ctx.tx, ctx.companyId, data.salespersonId) : null,
      priority: data.priority ?? 0,
      active: true,
      createdBy: ctx.userId,
    })
    .returning({ id: leads.id, reference: leads.reference });
  if (!row) return err('INTERNAL', 'Lead insert returned no row');

  await audit(ctx, { entity: 'crm.lead', recordId: row.id, action: 'create', after: { reference, name: data.name, stageId: stage.id } });
  await emit(ctx, {
    name: 'crm.lead.created',
    payload: { leadId: row.id, stageId: stage.id, userId: ctx.userId, teamId: null },
  });
  return ok({ id: row.id, reference: row.reference });
}

export async function updateLead(ctx: Ctx, id: string, input: LeadUpdateInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'crm.lead.write');
  if (!perm.ok) return perm;
  const parsed = leadUpdateInput.safeParse(input);
  if (!parsed.success) return err('VALIDATION', 'Invalid lead', { fields: parsed.error.issues.map((i) => i.path.join('.')) });

  const before = await lockLead(ctx, id);
  if (!before) return err('NOT_FOUND', 'Lead not found');
  const data = parsed.data;
  if (data.partnerId && !(await partnerExists(ctx, data.partnerId))) {
    return err('NOT_FOUND', 'Partner not found');
  }

  // Undefined keys are skipped by drizzle's update set, so only given fields change.
  // A new salesperson brings their team along. Leads keep their team otherwise.
  const teamId =
    data.salespersonId !== undefined
      ? await teamIdForUser(ctx.tx, ctx.companyId, data.salespersonId)
      : undefined;
  await ctx.tx
    .update(leads)
    .set({ ...data, ...(data.salespersonId !== undefined ? { teamId } : {}), updatedAt: new Date() })
    .where(eq(leads.id, id));

  await audit(ctx, {
    entity: 'crm.lead',
    recordId: id,
    action: 'update',
    before: pick(before, Object.keys(data)),
    after: data,
  });
  return ok({ id });
}

function pick(row: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((k) => [k, row[k]]));
}

/** Moves the lead to a stage of its own pipeline. A won stage marks the lead won. */
export async function moveLead(ctx: Ctx, id: string, stageId: string): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'crm.lead.write');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(stageId)) return err('VALIDATION', 'Invalid stage id');

  const lead = await lockLead(ctx, id);
  if (!lead) return err('NOT_FOUND', 'Lead not found');
  if (lead.status === 'lost') return err('CONFLICT', 'Reopen the lead before moving it');
  if (lead.stageId === stageId) return ok({ id });

  const target = await loadStage(ctx, stageId);
  if (!target) return err('NOT_FOUND', 'Stage not found');
  if (target.pipelineId !== lead.pipelineId) return err('VALIDATION', 'Stage belongs to another pipeline');
  const previous = await loadStage(ctx, lead.stageId);

  const now = new Date();
  const won = target.isWon;
  const patch = {
    stageId: target.id,
    stageEnteredAt: now,
    probability: target.probability,
    status: won ? 'won' : 'open',
    wonAt: won ? (lead.wonAt ?? now) : null,
    updatedAt: now,
  };
  await ctx.tx.update(leads).set(patch).where(eq(leads.id, id));

  await audit(ctx, {
    entity: 'crm.lead',
    recordId: id,
    action: 'move',
    before: { stageId: lead.stageId, status: lead.status },
    after: { stageId: target.id, status: patch.status },
  });

  const posted = await postMessage(ctx, {
    entity: 'crm.lead',
    recordId: id,
    kind: 'system',
    body: `Stage: ${previous?.name ?? '?'} -> ${target.name}${won ? ' (won)' : ''}`,
  });
  if (!posted.ok) return posted;

  await emit(ctx, {
    name: 'crm.lead.stage_changed',
    payload: { leadId: id, fromStageId: lead.stageId, toStageId: target.id, userId: ctx.userId },
  });
  if (won && lead.status !== 'won') {
    await emit(ctx, { name: 'crm.lead.won', payload: { leadId: id } });
  }
  return ok({ id });
}

/** Marks the lead lost. A reason is required by the database, so lostReasonId must be given. */
export async function markLost(
  ctx: Ctx,
  id: string,
  lostReasonId?: string,
  note?: string,
): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'crm.lead.write');
  if (!perm.ok) return perm;

  const lead = await lockLead(ctx, id);
  if (!lead) return err('NOT_FOUND', 'Lead not found');
  if (lead.status === 'lost') return err('CONFLICT', 'Lead is already lost');
  if (lead.status === 'won') return err('CONFLICT', 'A won lead cannot be marked lost');
  if (!lostReasonId) return err('VALIDATION', 'A lost reason is required');

  const [reasonRow] = await ctx.tx
    .select({ name: lostReasons.name })
    .from(lostReasons)
    .where(and(eq(lostReasons.companyId, ctx.companyId), eq(lostReasons.id, lostReasonId)));
  if (!reasonRow) return err('NOT_FOUND', 'Lost reason not found');

  const now = new Date();
  await ctx.tx
    .update(leads)
    .set({ status: 'lost', lostReasonId, lostAt: now, updatedAt: now })
    .where(eq(leads.id, id));

  await audit(ctx, {
    entity: 'crm.lead',
    recordId: id,
    action: 'mark_lost',
    before: { status: lead.status },
    after: { status: 'lost', lostReasonId },
  });

  const posted = await postMessage(ctx, {
    entity: 'crm.lead',
    recordId: id,
    kind: 'system',
    body: `Marked lost: ${reasonRow.name}`,
  });
  if (!posted.ok) return posted;
  if (note?.trim()) {
    const noted = await postMessage(ctx, { entity: 'crm.lead', recordId: id, kind: 'note', body: note.trim() });
    if (!noted.ok) return noted;
  }
  await emit(ctx, { name: 'crm.lead.lost', payload: { leadId: id, lostReasonId } });
  return ok({ id });
}

/** Reopens a lost lead at the probability of its current stage. */
export async function reopenLead(ctx: Ctx, id: string): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'crm.lead.write');
  if (!perm.ok) return perm;

  const lead = await lockLead(ctx, id);
  if (!lead) return err('NOT_FOUND', 'Lead not found');
  if (lead.status !== 'lost') return err('CONFLICT', 'Only a lost lead can be reopened');
  const stage = await loadStage(ctx, lead.stageId);

  const now = new Date();
  await ctx.tx
    .update(leads)
    .set({
      status: 'open',
      lostAt: null,
      lostReasonId: null,
      probability: stage?.probability ?? lead.probability,
      updatedAt: now,
    })
    .where(eq(leads.id, id));

  await audit(ctx, {
    entity: 'crm.lead',
    recordId: id,
    action: 'reopen',
    before: { status: 'lost' },
    after: { status: 'open' },
  });

  const posted = await postMessage(ctx, { entity: 'crm.lead', recordId: id, kind: 'system', body: 'Lead reopened' });
  if (!posted.ok) return posted;
  return ok({ id });
}

/** Counts one contact attempt on the lead. */
export async function logAttempt(ctx: Ctx, id: string): Promise<Result<{ id: string; attemptCount: number }>> {
  const perm = requirePerm(ctx, 'crm.lead.write');
  if (!perm.ok) return perm;

  const lead = await lockLead(ctx, id);
  if (!lead) return err('NOT_FOUND', 'Lead not found');

  const [row] = await ctx.tx
    .update(leads)
    .set({ attemptCount: sql`${leads.attemptCount} + 1`, updatedAt: new Date() })
    .where(eq(leads.id, id))
    .returning({ attemptCount: leads.attemptCount });
  if (!row) return err('INTERNAL', 'Attempt was not recorded');

  await audit(ctx, {
    entity: 'crm.lead',
    recordId: id,
    action: 'log_attempt',
    before: { attemptCount: lead.attemptCount },
    after: { attemptCount: row.attemptCount },
  });
  return ok({ id, attemptCount: row.attemptCount });
}

export type ConvertInput = Omit<DraftContractInput, 'leadId' | 'partnerId'>;

/**
 * Creates a draft contract from the lead. Creates the partner from the lead contact fields when the
 * lead has none. Everything runs in a savepoint, so a failed draft leaves no partner behind.
 */
export async function convertToContract(
  ctx: Ctx,
  leadId: string,
  draft: ConvertInput,
): Promise<Result<{ contractId: string; partnerId: string }>> {
  const perm = requirePerm(ctx, 'crm.lead.write');
  if (!perm.ok) return perm;

  const lead = await lockLead(ctx, leadId);
  if (!lead) return err('NOT_FOUND', 'Lead not found');
  if (lead.convertedContractId) return err('CONFLICT', 'Lead is already converted');
  if (lead.status === 'lost') return err('CONFLICT', 'Reopen the lead before converting it');

  const outcome: { error?: AppError; contractId?: string; partnerId?: string } = {};
  try {
    await ctx.tx.transaction(async (sp) => {
      const spCtx: Ctx = { ...ctx, tx: sp };

      let partnerId = lead.partnerId;
      if (!partnerId) {
        partnerId = await insertPartnerFromLead(spCtx, lead);
      } else {
        await ensureCustomer(spCtx, partnerId);
      }

      const contract = await createDraftContract(spCtx, { ...draft, leadId, partnerId });
      if (!contract.ok) {
        outcome.error = contract.error;
        sp.rollback();
      }

      const now = new Date();
      await sp
        .update(leads)
        .set({
          partnerId,
          convertedContractId: contract.ok ? contract.value.id : null,
          status: 'won',
          wonAt: lead.wonAt ?? now,
          updatedAt: now,
        })
        .where(eq(leads.id, leadId));

      if (lead.status !== 'won') {
        await emit(spCtx, { name: 'crm.lead.won', payload: { leadId } });
      }

      await audit(spCtx, {
        entity: 'crm.lead',
        recordId: leadId,
        action: 'convert',
        before: { convertedContractId: lead.convertedContractId, partnerId: lead.partnerId },
        after: { convertedContractId: contract.ok ? contract.value.id : null, partnerId },
      });

      const posted = await postMessage(spCtx, {
        entity: 'crm.lead',
        recordId: leadId,
        kind: 'system',
        body: 'Converted to draft contract',
      });
      if (!posted.ok) {
        outcome.error = posted.error;
        sp.rollback();
      }

      outcome.contractId = contract.ok ? contract.value.id : undefined;
      outcome.partnerId = partnerId;
    });
  } catch (e) {
    // Only the rollback issued above is expected here.
    if (!outcome.error) throw e;
  }

  if (outcome.error) return { ok: false, error: outcome.error };
  if (!outcome.contractId || !outcome.partnerId) return err('INTERNAL', 'Conversion produced no contract');
  return ok({ contractId: outcome.contractId, partnerId: outcome.partnerId });
}

// A draft contract needs a customer, so an existing partner linked to the lead becomes one here.
async function ensureCustomer(ctx: Ctx, partnerId: string): Promise<void> {
  const [row] = await ctx.tx
    .update(partners)
    .set({ isCustomer: true, updatedAt: new Date() })
    .where(and(eq(partners.id, partnerId), eq(partners.companyId, ctx.companyId), eq(partners.isCustomer, false)))
    .returning({ id: partners.id });
  if (row) {
    await audit(ctx, { entity: 'contacts.partner', recordId: partnerId, action: 'update', after: { isCustomer: true, origin: 'crm.lead' } });
  }
}

// Splits the lead contact into an individual partner. The partner is a customer from now on.
async function insertPartnerFromLead(ctx: Ctx, lead: typeof leads.$inferSelect): Promise<string> {
  const displayName = lead.contactName?.trim() || lead.name;
  const [firstName, ...rest] = displayName.split(/\s+/);
  const [row] = await ctx.tx
    .insert(partners)
    .values({
      companyId: ctx.companyId,
      kind: 'individual',
      isCustomer: true,
      displayName,
      firstName: firstName || displayName,
      lastName: rest.join(' '),
      phone: lead.phone,
      email: lead.email,
      wilayaCode: lead.wilayaCode,
      salespersonId: lead.salespersonId,
      createdBy: ctx.userId,
    })
    .returning({ id: partners.id });
  if (!row) throw new Error('partner insert returned no row');
  await audit(ctx, { entity: 'contacts.partner', recordId: row.id, action: 'create', after: { displayName, origin: 'crm.lead', leadId: lead.id } });
  return row.id;
}
