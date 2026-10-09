import { and, count, eq, gte } from 'drizzle-orm';
import { currentProviderName, type AiResult } from '@/core/adapters/ai';
import { readEnv } from '@/core/adapters/ai/http';
import type { Ctx } from '@/core/ctx';
import { aiUsage } from '@/core/db/schema/ai';
import { err, ok, type Result } from '@/core/result';

export const DEFAULT_AI_DAILY_LIMIT = 200;

// Writes one usage row under the caller's transaction.
export async function recordAiUsage(ctx: Ctx, result: AiResult, feature: string): Promise<void> {
  await ctx.tx.insert(aiUsage).values({
    companyId: ctx.companyId,
    userId: ctx.userId,
    feature,
    provider: currentProviderName(),
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });
}

function dailyLimit(): number {
  const raw = readEnv().AI_DAILY_LIMIT?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_AI_DAILY_LIMIT;
}

// Refuses when this company has used its daily AI calls (UTC day). Counts rows, so call it before each AI request.
export async function assertAiQuota(ctx: Ctx): Promise<Result<void>> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [row] = await ctx.tx
    .select({ n: count() })
    .from(aiUsage)
    .where(and(eq(aiUsage.companyId, ctx.companyId), gte(aiUsage.createdAt, startOfDay)));
  const used = Number(row?.n ?? 0);
  if (used >= dailyLimit()) return err('FORBIDDEN', 'AI_QUOTA');
  return ok(undefined);
}
