import type { Ctx, Locale } from '@/core/ctx';
import { getAi, type AiProvider, type AiResult } from '@/core/adapters/ai';
import { assertAiQuota, recordAiUsage } from '@/core/ai/usage';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { ACTION_KINDS, type ActionKind } from '../actions/rules';
import { propose, type ActionProposal } from '../actions/service';
import { planActionKinds, planActionProposals, planToolCalls, TOOL_DESCRIPTIONS, ASSISTANT_TOOL_NAMES, type AssistantToolName } from './plan';
import { runAssistantTool, type AssistantTable } from './tools';

export interface AssistantAnswer { answer: string; tables: AssistantTable[]; proposals: ActionProposal[] }

const ACTION_HELP: Record<ActionKind, string> = {
  reminder_batch: 'prepare WhatsApp payment reminders for up to 10 contracts that have late installments. Use {"kind":"reminder_batch","contractIds":[...]}',
  draft_invoice: 'draft one unposted sales invoice for a customer. Use {"kind":"draft_invoice","partnerId":"...","lines":[{"description":"...","quantity":"1","unitPriceCents":"100000"}]}. Only lines the user stated',
};

const PERM = 'ai_features.assistant.use';
const LANGUAGE: Record<Locale, string> = { fr: 'French', ar: 'Arabic', en: 'English' };

/**
 * Answers a business question. Flow: AI picks read-only tools from a fixed list, the tools run in the
 * tenant transaction, then AI writes the answer from those results only. If the question asks for an
 * action, a second AI call proposes it using only IDs from those results. Proposals are stored, never run.
 * The assistant itself writes nothing until the user confirms a proposal.
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
        content: `You choose which read-only tools answer a business question. Reply with one JSON object {"tools": [names]} using only these names:\n${toolList}\nReturn an empty list if none apply. If the user asks you to do one of these actions, also add "actions": [kinds], using only these kinds: ${ACTION_KINDS.join(', ')}.`,
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
  const actionKinds = planActionKinds(plan.text);

  const answerFeature = 'ai_features.assistant.answer';
  // The answer call sees the same tables without the IDs, so UUIDs do not leak into the prose.
  const answerTables = tables.map((t) => ({ title: t.title, columns: t.columns, rows: t.rows }));
  const answer = await ai.complete(
    [
      {
        role: 'system',
        content: `Answer the user's business question in ${LANGUAGE[ctx.locale]}, in at most 6 sentences. Use only the tool results provided. If they do not contain the answer, say so. Never invent figures.`,
      },
      {
        role: 'user',
        content: `Question: ${question}\n\nTool results (JSON):\n${JSON.stringify(answerTables)}`,
      },
    ],
    { maxTokens: 500, temperature: 0.2, feature: answerFeature },
  );
  await recordAiUsage(ctx, answer, answerFeature);

  const proposals = actionKinds.length > 0 ? await proposeActions(ctx, ai, question, tables, actionKinds) : [];
  return ok({ answer: answer.text.trim(), tables, proposals });
}

/** Asks for the requested actions with the tool tables as the only source of IDs, then stores each one as a proposal. */
async function proposeActions(
  ctx: Ctx,
  ai: AiProvider,
  question: string,
  tables: AssistantTable[],
  kinds: ActionKind[],
): Promise<ActionProposal[]> {
  const quota = await assertAiQuota(ctx);
  if (!quota.ok) return [];

  const allowedIds = new Set<string>();
  for (const t of tables) {
    for (const row of t.ids ?? []) {
      for (const v of Object.values(row)) for (const id of Array.isArray(v) ? v : [v]) allowedIds.add(id);
    }
  }
  if (allowedIds.size === 0) return [];

  const actionFeature = 'ai_features.assistant.actions';
  const help = kinds.map((k) => `- ${k}: ${ACTION_HELP[k]}`).join('\n');
  const reply: AiResult | null = await ai.complete(
    [
      {
        role: 'system',
        content: `Propose the actions the user asked for. Reply with one JSON object {"actions": [...]}. Allowed actions:\n${help}\nUse only IDs that appear in the tool results. Return {"actions": []} if none apply. Never invent IDs or amounts that the user did not state.`,
      },
      { role: 'user', content: `Question: ${question}\n\nTool results (JSON):\n${JSON.stringify(tables)}` },
    ],
    { json: true, maxTokens: 600, temperature: 0, feature: actionFeature },
  ).catch((): null => null);
  // Proposals are optional: if this call fails, the answer the user already has is still returned.
  if (!reply) return [];
  await recordAiUsage(ctx, reply, actionFeature);

  const out: ActionProposal[] = [];
  for (const p of planActionProposals(reply.text, allowedIds)) {
    if (!kinds.includes(p.kind)) continue;
    const res = await propose(ctx, p);
    if (res.ok) out.push(res.value);
  }
  return out;
}
