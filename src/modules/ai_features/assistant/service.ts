import type { Ctx, Locale } from '@/core/ctx';
import { getAi } from '@/core/adapters/ai';
import { assertAiQuota, recordAiUsage } from '@/core/ai/usage';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { planToolCalls, TOOL_DESCRIPTIONS, ASSISTANT_TOOL_NAMES, type AssistantToolName } from './plan';
import { runAssistantTool, type AssistantTable } from './tools';

export interface AssistantAnswer { answer: string; tables: AssistantTable[] }

const PERM = 'ai_features.assistant.use';
const LANGUAGE: Record<Locale, string> = { fr: 'French', ar: 'Arabic', en: 'English' };

/**
 * Answers a business question. Flow: AI picks read-only tools from a fixed list, the tools run in the
 * tenant transaction, then AI writes the answer from those results only. Never writes data.
 */
export async function askAssistant(ctx: Ctx, question: string): Promise<Result<AssistantAnswer>> {
  const perm = requirePerm(ctx, PERM);
  if (!perm.ok) return perm;

  const ai = getAi();
  if (!ai) return err('FORBIDDEN', 'AI is not configured', { messageKey: 'errors.not_configured' });

  const quota = await assertAiQuota(ctx);
  if (!quota.ok) return quota;

  const toolList = ASSISTANT_TOOL_NAMES.map((n) => `- ${n}: ${TOOL_DESCRIPTIONS[n]}`).join('\n');
  const planFeature = 'ai_features.assistant.plan';
  const plan = await ai.complete(
    [
      {
        role: 'system',
        content: `You choose which read-only tools answer a business question. Reply with one JSON object {"tools": [names]} using only these names:\n${toolList}\nReturn an empty list if none apply.`,
      },
      { role: 'user', content: question },
    ],
    { json: true, maxTokens: 200, feature: planFeature },
  );
  await recordAiUsage(ctx, plan, planFeature);

  const names: AssistantToolName[] = planToolCalls(plan.text);
  if (names.length === 0) return err('VALIDATION', 'no tool matched the question', { messageKey: 'errors.no_tool' });

  const tables: AssistantTable[] = [];
  for (const name of names) {
    const res = await runAssistantTool(ctx, name);
    if (!res.ok) return res;
    tables.push(res.value);
  }

  const answerFeature = 'ai_features.assistant.answer';
  const answer = await ai.complete(
    [
      {
        role: 'system',
        content: `Answer the user's business question in ${LANGUAGE[ctx.locale]}, in at most 6 sentences. Use only the tool results provided. If they do not contain the answer, say so. Never invent figures.`,
      },
      {
        role: 'user',
        content: `Question: ${question}\n\nTool results (JSON):\n${JSON.stringify(tables)}`,
      },
    ],
    { maxTokens: 500, temperature: 0.2, feature: answerFeature },
  );
  await recordAiUsage(ctx, answer, answerFeature);

  return ok({ answer: answer.text.trim(), tables });
}
