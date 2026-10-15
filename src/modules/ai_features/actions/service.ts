import { and, asc, eq, gte } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx, Locale } from '@/core/ctx';
import { aiActions, aiReminderLog } from '@/core/db/schema';
import { formatDzd, type Cents } from '@/core/money';
import { requirePerm } from '@/core/perms';
import { err, ok, type AppError, type Result } from '@/core/result';
import { partners } from '@/modules/contacts/schema';
import { daysLateSince } from '@/modules/ai_features/reminders/draft';
import { getContract } from '@/modules/credit_sales/service/contracts';
import { buildReminderMessage, whatsappLink } from '@/modules/credit_sales/service/reminders';
import { createInvoice, planDraft, type NewInvoice } from '@/modules/invoicing/service/create';
import {
  ACTION_PERM,
  DOMAIN_PERM,
  nextReminderStage,
  parseStoredPayload,
  payloadOf,
  ACTION_KINDS,
  type ActionKind,
  type Proposal,
  type ReminderStage,
  type StoredPayload,
} from './rules';

/*
 * Confirmable AI actions. Flow: propose() stores a 'proposed' row with a server-computed summary.
 * confirm() claims it atomically, re-validates the stored payload, recomputes the work from current data
 * and runs it through the domain services. reject() drops it. The model never supplies amounts, text or recipients.
 *
 * defineAction rolls back the whole transaction on any err result. So confirm() returns ok with
 * state 'failed' for stale or failing work, which keeps the claim and the failure mark. Real errors
 * (permission, not found, already decided) return err, which rolls back nothing that matters.
 */

export interface ReminderSummaryItem {
  contractId: string;
  partnerId: string;
  contractNumber: string;
  partnerName: string;
  daysLate: number;
  amountText: string;
  stage: ReminderStage;
}
export interface ReminderBatchSummary { kind: 'reminder_batch'; items: ReminderSummaryItem[] }
export interface InvoiceSummary {
  kind: 'draft_invoice';
  partnerId: string;
  partnerName: string;
  lines: { description: string; quantity: string; unitPriceText: string }[];
  untaxedText: string;
  taxText: string;
  totalText: string;
}
export type ActionSummary = ReminderBatchSummary | InvoiceSummary;

export interface ActionProposal { id: string; kind: ActionKind; summary: ActionSummary }

export type ActionResult =
  | { kind: 'reminder_batch'; items: { contractId: string; stage: ReminderStage; text: string; whatsappUrl: string | null }[] }
  | { kind: 'draft_invoice'; invoiceId: string };

/** 'failed' is a normal outcome (stale, invalid, domain error), not an err. See the header comment. */
export interface ConfirmOutcome {
  actionId: string;
  state: 'confirmed' | 'failed';
  errorCode: string | null;
  result: ActionResult | null;
}

interface Candidate {
  contractId: string;
  partnerId: string;
  partnerName: string;
  phone: string | null;
  contractNumber: string;
  dueDate: string;
  daysLate: number;
  amountCents: bigint;
  stage: ReminderStage;
}

const isActionKind = (k: string): k is ActionKind => (ACTION_KINDS as readonly string[]).includes(k);

/**
 * Reminders due now for the given contracts. Each ID is re-checked against the tenant (getContract is tenant-scoped).
 * Contracts with nothing late, or with no stage due, are skipped. An unknown ID returns the NOT_FOUND error.
 */
async function reminderCandidates(ctx: Ctx, contractIds: string[], now: Date): Promise<Result<Candidate[]>> {
  const out: Candidate[] = [];
  for (const contractId of contractIds) {
    const detail = await getContract(ctx, contractId);
    if (!detail.ok) return detail;
    // A contract that is no longer active is not eligible, so a proposal for it goes stale.
    if (detail.value.contract.state !== 'active') continue;

    const late = detail.value.installments
      .filter((i) => i.status === 'late')
      .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
    const earliest = late[0];
    if (!earliest) continue;

    const daysLate = daysLateSince(earliest.dueDate, now);
    // Only reminders prepared for this late episode count. Older episodes neither block nor escalate it.
    const episodeStart = new Date(`${earliest.dueDate}T00:00:00Z`);
    const history = await ctx.tx
      .select({ stage: aiReminderLog.stage, createdAt: aiReminderLog.createdAt })
      .from(aiReminderLog)
      .where(
        and(
          eq(aiReminderLog.companyId, ctx.companyId),
          eq(aiReminderLog.contractId, contractId),
          gte(aiReminderLog.createdAt, episodeStart),
        ),
      )
      .orderBy(asc(aiReminderLog.createdAt));
    const lastAt = history[history.length - 1]?.createdAt;
    const daysSinceLast = lastAt ? Math.floor((now.getTime() - lastAt.getTime()) / 86_400_000) : undefined;
    const stage = nextReminderStage(daysLate, history.map((h) => h.stage as ReminderStage), daysSinceLast);
    if (!stage) continue;

    out.push({
      contractId,
      partnerId: detail.value.partner.id,
      partnerName: detail.value.partner.name,
      phone: detail.value.partner.phone,
      contractNumber: detail.value.contract.reference,
      dueDate: earliest.dueDate,
      daysLate,
      amountCents: late.reduce((sum, i) => sum + (i.amountCents - i.paidCents), 0n),
      stage,
    });
  }
  return ok(out);
}

function reminderText(c: Candidate, shopName: string, locale: Locale): { text: string; whatsappUrl: string | null } {
  const text = buildReminderMessage(locale, {
    partnerName: c.partnerName,
    shopName,
    amountCents: c.amountCents,
    dueDate: c.dueDate,
    contractNumber: c.contractNumber,
    daysLate: c.daysLate,
    stage: c.stage,
  });
  return { text, whatsappUrl: whatsappLink(c.phone, text) };
}

const money = (cents: bigint, locale: Locale): string => formatDzd(cents as Cents, locale);

async function draftInvoiceSummary(
  ctx: Ctx,
  p: Extract<Proposal, { kind: 'draft_invoice' }>,
): Promise<Result<InvoiceSummary>> {
  const input: NewInvoice = {
    type: 'out_invoice',
    partnerId: p.partnerId,
    lines: p.lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPriceCents: BigInt(l.unitPriceCents) })),
  };
  // planDraft checks the partner (tenant and customer role), taxes and totals. It writes nothing.
  const plan = await planDraft(ctx, input);
  if (!plan.ok) return plan;

  const [partner] = await ctx.tx
    .select({ name: partners.displayName })
    .from(partners)
    .where(and(eq(partners.companyId, ctx.companyId), eq(partners.id, p.partnerId)));
  if (!partner) return err('NOT_FOUND', 'partner not found', { field: 'partnerId' });

  return ok({
    kind: 'draft_invoice',
    partnerId: p.partnerId,
    partnerName: partner.name,
    lines: p.lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unitPriceText: money(BigInt(l.unitPriceCents), ctx.locale),
    })),
    untaxedText: money(plan.value.untaxedCents, ctx.locale),
    taxText: money(plan.value.taxCents, ctx.locale),
    totalText: money(plan.value.untaxedCents + plan.value.taxCents, ctx.locale),
  });
}

/**
 * A new reminder proposal replaces this user's still-open ones that cover any of the same contracts, so the
 * same debtor is never chased from two live cards. Older cards then answer STATE instead of sending twice.
 */
async function supersedeOpenReminders(ctx: Ctx, contractIds: string[], now: Date) {
  const open = await ctx.tx
    .select({ id: aiActions.id, payload: aiActions.payload })
    .from(aiActions)
    .where(
      and(
        eq(aiActions.companyId, ctx.companyId),
        eq(aiActions.userId, ctx.userId),
        eq(aiActions.kind, 'reminder_batch'),
        eq(aiActions.state, 'proposed'),
      ),
    );
  const wanted = new Set(contractIds);
  for (const row of open) {
    const ids = (row.payload as { contractIds?: string[] } | null)?.contractIds ?? [];
    if (!ids.some((id) => wanted.has(id))) continue;
    await ctx.tx
      .update(aiActions)
      .set({ state: 'rejected', decidedAt: now })
      .where(and(eq(aiActions.id, row.id), eq(aiActions.state, 'proposed')));
  }
}

/**
 * Stores a proposal. Re-validates every ID against the tenant and builds the summary the user will confirm.
 * Caps are enforced by the zod schema in rules.ts.
 */
export async function propose(ctx: Ctx, proposal: Proposal, now = new Date()): Promise<Result<ActionProposal>> {
  const perm = requirePerm(ctx, ACTION_PERM);
  if (!perm.ok) return perm;
  const domain = requirePerm(ctx, DOMAIN_PERM[proposal.kind]);
  if (!domain.ok) return domain;

  let summary: ActionSummary;
  if (proposal.kind === 'reminder_batch') {
    const cands = await reminderCandidates(ctx, proposal.contractIds, now);
    if (!cands.ok) return cands;
    if (cands.value.length === 0) return err('VALIDATION', 'No reminder is due for these contracts');
    summary = {
      kind: 'reminder_batch',
      items: cands.value.map((c) => ({
        contractId: c.contractId,
        partnerId: c.partnerId,
        contractNumber: c.contractNumber,
        partnerName: c.partnerName,
        daysLate: c.daysLate,
        amountText: money(c.amountCents, ctx.locale),
        stage: c.stage,
      })),
    };
  } else {
    const built = await draftInvoiceSummary(ctx, proposal);
    if (!built.ok) return built;
    summary = built.value;
  }

  if (proposal.kind === 'reminder_batch') await supersedeOpenReminders(ctx, proposal.contractIds, now);

  const [row] = await ctx.tx
    .insert(aiActions)
    .values({
      companyId: ctx.companyId,
      userId: ctx.userId,
      kind: proposal.kind,
      payload: payloadOf(proposal),
      summary,
    })
    .returning({ id: aiActions.id });
  if (!row) return err('INTERNAL', 'could not store action');
  await audit(ctx, { entity: 'ai_features.action', recordId: row.id, action: 'propose', after: { kind: proposal.kind } });
  return ok({ id: row.id, kind: proposal.kind, summary });
}

async function ownAction(ctx: Ctx, actionId: string) {
  const [row] = await ctx.tx
    .select()
    .from(aiActions)
    .where(and(eq(aiActions.id, actionId), eq(aiActions.companyId, ctx.companyId), eq(aiActions.userId, ctx.userId)));
  return row ?? null;
}

/** Records the final state. Runs in the outer transaction, so it commits even when the outcome is 'failed'. */
async function settle(
  ctx: Ctx,
  row: { id: string; kind: string },
  state: 'confirmed' | 'failed',
  errorCode: string | null,
  result: ActionResult | null,
  now: Date,
): Promise<Result<ConfirmOutcome>> {
  await ctx.tx.update(aiActions).set({ state, errorCode, result, decidedAt: now }).where(eq(aiActions.id, row.id));
  await audit(ctx, {
    entity: 'ai_features.action',
    recordId: row.id,
    action: state === 'confirmed' ? 'confirm' : 'fail',
    after: { kind: row.kind, state, errorCode },
  });
  return ok({ actionId: row.id, state, errorCode, result });
}

async function execute(
  ctx: Ctx,
  actionId: string,
  payload: StoredPayload,
  expected: ReminderSummaryItem[],
  shopName: string,
  now: Date,
): Promise<Result<ActionResult>> {
  if (payload.kind === 'reminder_batch') {
    const cands = await reminderCandidates(ctx, payload.contractIds, now);
    if (!cands.ok) return cands;
    // Stale when the set or any stage differs from what the user confirmed. Text and amounts are recomputed, not reused.
    const stale =
      cands.value.length !== expected.length ||
      expected.some((e) => !cands.value.some((c) => c.contractId === e.contractId && c.stage === e.stage));
    if (stale) return err('CONFLICT', 'Reminders changed since they were prepared');

    const items: { contractId: string; stage: ReminderStage; text: string; whatsappUrl: string | null }[] = [];
    for (const c of cands.value) {
      const { text, whatsappUrl } = reminderText(c, shopName, ctx.locale);
      await ctx.tx.insert(aiReminderLog).values({
        companyId: ctx.companyId,
        contractId: c.contractId,
        partnerId: c.partnerId,
        stage: c.stage,
        actionId,
      });
      items.push({ contractId: c.contractId, stage: c.stage, text, whatsappUrl });
    }
    return ok({ kind: 'reminder_batch', items });
  }

  const invoice: NewInvoice = {
    type: 'out_invoice',
    partnerId: payload.partnerId,
    lines: payload.lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPriceCents: BigInt(l.unitPriceCents) })),
  };
  const created = await createInvoice(ctx, invoice);
  if (!created.ok) return created;
  return ok({ kind: 'draft_invoice', invoiceId: created.value.id });
}

/** Runs one step in a savepoint. Any failure rolls back the step's partial writes but not the caller's claim. */
async function runStep(ctx: Ctx, step: (sp: Ctx) => Promise<Result<ActionResult>>): Promise<Result<ActionResult>> {
  let failure = null as AppError | null;
  try {
    const value = await ctx.tx.transaction(async (sp) => {
      const res = await step({ ...ctx, tx: sp });
      if (!res.ok) {
        failure = res.error;
        throw new Error('ACTION_STEP_ROLLBACK');
      }
      return res.value;
    });
    return ok(value);
  } catch (e) {
    if (failure) return { ok: false, error: failure };
    throw e;
  }
}

/**
 * Confirms one of the user's own proposed actions. Single use: the state moves proposed -> confirmed in one
 * conditional UPDATE, and only the caller that gets the row runs the work.
 */
export async function confirm(ctx: Ctx, actionId: string, shopName = '', now = new Date()): Promise<Result<ConfirmOutcome>> {
  const perm = requirePerm(ctx, ACTION_PERM);
  if (!perm.ok) return perm;

  const row = await ownAction(ctx, actionId);
  if (!row) return err('NOT_FOUND', 'Action not found');
  if (!isActionKind(row.kind)) return err('INTERNAL', 'unknown action kind');
  const domain = requirePerm(ctx, DOMAIN_PERM[row.kind]);
  if (!domain.ok) return domain;
  if (row.state !== 'proposed') return err('STATE', 'Action is already decided');

  const [claimed] = await ctx.tx
    .update(aiActions)
    .set({ state: 'confirmed', decidedAt: now })
    .where(
      and(
        eq(aiActions.id, actionId),
        eq(aiActions.companyId, ctx.companyId),
        eq(aiActions.userId, ctx.userId),
        eq(aiActions.state, 'proposed'),
      ),
    )
    .returning();
  if (!claimed) return err('STATE', 'Action is already decided');

  const payload = parseStoredPayload(claimed.kind, claimed.payload);
  if (!payload) return settle(ctx, claimed, 'failed', 'VALIDATION', null, now);

  const summary = claimed.summary as ActionSummary;
  const expected = summary.kind === 'reminder_batch' ? summary.items : [];
  const step = await runStep(ctx, (sp) => execute(sp, claimed.id, payload, expected, shopName, now));
  if (!step.ok) return settle(ctx, claimed, 'failed', step.error.code, null, now);
  return settle(ctx, claimed, 'confirmed', null, step.value, now);
}

/** Drops one of the user's own proposed actions. Nothing is written to the domain. */
export async function reject(ctx: Ctx, actionId: string, now = new Date()): Promise<Result<{ actionId: string; state: 'rejected' }>> {
  const perm = requirePerm(ctx, ACTION_PERM);
  if (!perm.ok) return perm;

  const row = await ownAction(ctx, actionId);
  if (!row) return err('NOT_FOUND', 'Action not found');
  if (row.state !== 'proposed') return err('STATE', 'Action is already decided');

  const [updated] = await ctx.tx
    .update(aiActions)
    .set({ state: 'rejected', decidedAt: now })
    .where(
      and(
        eq(aiActions.id, actionId),
        eq(aiActions.companyId, ctx.companyId),
        eq(aiActions.userId, ctx.userId),
        eq(aiActions.state, 'proposed'),
      ),
    )
    .returning({ id: aiActions.id });
  if (!updated) return err('STATE', 'Action is already decided');
  await audit(ctx, { entity: 'ai_features.action', recordId: actionId, action: 'reject', after: { kind: row.kind } });
  return ok({ actionId, state: 'rejected' });
}
