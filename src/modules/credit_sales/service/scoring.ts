import { and, desc, eq } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { err, ok, type Result } from '@/core/result';
import { creditClientScores, creditContracts, creditInstallments } from '../schema';

/*
 * Client risk score: a HEURISTIC built from this company's own payment history.
 * It is NOT a credit bureau score and must not be presented as one.
 *
 * Rules (start at 70, clamp to 0..100):
 *   +5 per completed contract (max +15)
 *   +1 per installment paid on time (max +15)
 *   -3 per installment paid late
 *   -10 per installment currently late (unpaid and past due)
 *   -1 per 5 average days late on late-paid installments (floor)
 * Bands: A >= 80, B >= 60, C >= 40, otherwise D.
 * A partner with no history gets band 'new' and is not persisted.
 */

export interface ScoringHistory {
  paidOnTime: number;
  paidLate: number;
  avgDaysLate: number;
  currentlyLate: number;
  completedContracts: number;
}

export type ScoreGrade = 'A' | 'B' | 'C' | 'D' | 'new';

export interface ScoreResult {
  grade: ScoreGrade;
  score: number;
  reasons: string[];
}

const BASE = 70;
const DAY_MS = 86_400_000;

export function computeScore(h: ScoringHistory): ScoreResult {
  const hasHistory =
    h.paidOnTime + h.paidLate + h.currentlyLate + h.completedContracts > 0;

  const reasons: string[] = [];
  let score = BASE;

  const contractBonus = Math.min(15, 5 * h.completedContracts);
  if (contractBonus > 0) {
    score += contractBonus;
    reasons.push(`+${contractBonus} completed contracts (${h.completedContracts})`);
  }

  const onTimeBonus = Math.min(15, h.paidOnTime);
  if (onTimeBonus > 0) {
    score += onTimeBonus;
    reasons.push(`+${onTimeBonus} on-time payments (${h.paidOnTime})`);
  }

  if (h.paidLate > 0) {
    score -= 3 * h.paidLate;
    reasons.push(`-${3 * h.paidLate} late payments (${h.paidLate})`);
  }

  if (h.currentlyLate > 0) {
    score -= 10 * h.currentlyLate;
    reasons.push(`-${10 * h.currentlyLate} currently late (${h.currentlyLate})`);
  }

  const latePenalty = Math.floor(Math.max(0, h.avgDaysLate) / 5);
  if (latePenalty > 0) {
    score -= latePenalty;
    reasons.push(`-${latePenalty} average ${Math.round(h.avgDaysLate)} days late`);
  }

  score = Math.min(100, Math.max(0, score));

  if (!hasHistory) return { grade: 'new', score, reasons };

  const grade: ScoreGrade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
  return { grade, score, reasons };
}

/** Builds the history for a partner from installments and completed contracts. */
export async function loadHistory(ctx: Ctx, partnerId: string): Promise<ScoringHistory> {
  const rows = await ctx.tx
    .select({
      amountCents: creditInstallments.amountCents,
      paidCents: creditInstallments.paidCents,
      dueDate: creditInstallments.dueDate,
      lastPaidAt: creditInstallments.lastPaidAt,
    })
    .from(creditInstallments)
    .innerJoin(creditContracts, eq(creditContracts.id, creditInstallments.contractId))
    .where(eq(creditContracts.partnerId, partnerId));

  const completed = await ctx.tx
    .select({ id: creditContracts.id })
    .from(creditContracts)
    .where(and(eq(creditContracts.partnerId, partnerId), eq(creditContracts.state, 'completed')));

  const today = new Date().toISOString().slice(0, 10);
  const h: ScoringHistory = {
    paidOnTime: 0,
    paidLate: 0,
    avgDaysLate: 0,
    currentlyLate: 0,
    completedContracts: completed.length,
  };
  let lateDaysSum = 0;

  for (const r of rows) {
    if (r.paidCents >= r.amountCents) {
      if (!r.lastPaidAt) continue;
      const paidDay = r.lastPaidAt.toISOString().slice(0, 10);
      const days = Math.round((Date.parse(paidDay) - Date.parse(r.dueDate)) / DAY_MS);
      if (days <= 0) {
        h.paidOnTime += 1;
      } else {
        h.paidLate += 1;
        lateDaysSum += days;
      }
    } else if (r.dueDate < today) {
      h.currentlyLate += 1;
    }
  }
  h.avgDaysLate = h.paidLate > 0 ? lateDaysSum / h.paidLate : 0;
  return h;
}

/** Recomputes the score from history and appends a client_scores row (skipped when band is 'new'). */
export async function refreshScore(
  ctx: Ctx,
  partnerId: string,
): Promise<Result<{ grade: ScoreGrade; score: number }>> {
  if (!partnerId) return err('VALIDATION', 'partnerId is required');

  const history = await loadHistory(ctx, partnerId);
  const result = computeScore(history);
  if (result.grade === 'new') return ok({ grade: 'new', score: result.score });

  const [row] = await ctx.tx
    .insert(creditClientScores)
    .values({
      companyId: ctx.companyId,
      createdBy: null,
      partnerId,
      score: result.score,
      band: result.grade,
      method: 'rules',
      inputs: { ...history, reasons: result.reasons },
      computedAt: new Date(),
    })
    .returning({ id: creditClientScores.id });
  if (!row) return err('INTERNAL', 'could not store score');

  await audit(ctx, {
    entity: 'credit_sales.client_score',
    recordId: row.id,
    action: 'create',
    after: { partnerId, score: result.score, band: result.grade },
  });
  return ok({ grade: result.grade, score: result.score });
}

/** Latest stored score for a partner, or null when none has been computed. */
export async function latestScore(
  ctx: Ctx,
  partnerId: string,
): Promise<{ grade: Exclude<ScoreGrade, 'new'>; score: number; reasons: string[] } | null> {
  const [row] = await ctx.tx
    .select({
      score: creditClientScores.score,
      band: creditClientScores.band,
      inputs: creditClientScores.inputs,
    })
    .from(creditClientScores)
    .where(eq(creditClientScores.partnerId, partnerId))
    .orderBy(desc(creditClientScores.computedAt))
    .limit(1);
  if (!row) return null;
  const inputs = row.inputs as { reasons?: unknown };
  const reasons = Array.isArray(inputs?.reasons) ? inputs.reasons.map(String) : [];
  return { grade: row.band as Exclude<ScoreGrade, 'new'>, score: row.score, reasons };
}
