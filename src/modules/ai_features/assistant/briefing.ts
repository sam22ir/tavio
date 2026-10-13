import type { Ctx, Locale } from '@/core/ctx';
import { getAi, type AiProvider } from '@/core/adapters/ai';
import { assertAiQuota, recordAiUsage } from '@/core/ai/usage';
import { requirePerm } from '@/core/perms';
import { ok, type Result } from '@/core/result';
import { ACTION_PERM, REMINDER_BATCH_MAX } from '../actions/rules';
import { propose, type ActionProposal } from '../actions/service';
import { TOOL_PERMS, type AssistantToolName } from './plan';
import { runAssistantTool, type AssistantTable } from './tools';
import type { AssistantAnswer } from './service';

/*
 * Morning briefing. No planner call: the same read-only tools run in a fixed order, then one AI call
 * writes a short summary from their results. The reminder proposal comes from the collections queue rows,
 * so its IDs are real rows, never model output.
 */

export const BRIEFING_TOOLS: readonly AssistantToolName[] = ['kpis', 'collections_queue', 'unpaid_invoices', 'low_stock'];
export const BRIEFING_FEATURE = 'ai_features.assistant.briefing';
const COLLECTIONS_TOOL: AssistantToolName = 'collections_queue';
const LANGUAGE: Record<Locale, string> = { fr: 'French', ar: 'Arabic', en: 'English' };

/** Briefing tools the role may run. A missing permission drops that tool and never fails the briefing. */
export function briefingTools(ctx: Pick<Ctx, 'perms'>): AssistantToolName[] {
  return BRIEFING_TOOLS.filter((n) => {
    const needed = TOOL_PERMS[n];
    return !needed || requirePerm(ctx, needed).ok;
  });
}

/** Tables as the model may see them: title, columns and display rows. Real IDs never go to the model. */
export function modelTables(tables: AssistantTable[]): { title: string; columns: string[]; rows: string[][] }[] {
  return tables.map((t) => ({ title: t.title, columns: t.columns, rows: t.rows }));
}

/** Contract IDs from the collections queue, in queue order, de-duplicated and capped at the batch limit. */
export function collectionContractIds(table: AssistantTable | undefined): string[] {
  const out: string[] = [];
  for (const row of table?.ids ?? []) {
    const ids = row.contractIds;
    for (const id of Array.isArray(ids) ? ids : []) {
      if (out.includes(id)) continue;
      out.push(id);
      if (out.length === REMINDER_BATCH_MAX) return out;
    }
  }
  return out;
}

/** System and user messages for the briefing call. The user message carries no IDs. */
export function briefingMessages(locale: Locale, tables: AssistantTable[]): { system: string; user: string } {
  return {
    system:
      `You write a morning briefing for a small Algerian shop owner, in ${LANGUAGE[locale]}. ` +
      'Use at most 8 sentences, in this order: what needs attention today, who to chase first, which stock to reorder. ' +
      'Use only the tool results provided. Never invent figures. Never mention IDs or codes. ' +
      'If a part has no data, say so in one short phrase.',
    user: `Tool results (JSON):\n${JSON.stringify(modelTables(tables))}`,
  };
}

/** One AI call for the summary. Returns '' when AI is off, quota is spent, or the call fails. */
async function writeBriefing(ctx: Ctx, tables: AssistantTable[], useAi: boolean): Promise<string> {
  if (!useAi || tables.length === 0) return '';
  const ai: AiProvider | null = getAi();
  if (!ai) return '';
  const quota = await assertAiQuota(ctx);
  if (!quota.ok) return '';

  const msg = briefingMessages(ctx.locale, tables);
  let res;
  try {
    res = await ai.complete(
      [
        { role: 'system', content: msg.system },
        { role: 'user', content: msg.user },
      ],
      { maxTokens: 400, temperature: 0.2, feature: BRIEFING_FEATURE },
    );
  } catch {
    return '';
  }
  await recordAiUsage(ctx, res, BRIEFING_FEATURE);
  return res.text.trim().slice(0, 1500);
}

export interface BriefingOptions {
  /** Set false to skip the AI call, for example in integration tests. Defaults to true. */
  ai?: boolean;
}

/**
 * Builds the morning briefing. Permission gaps narrow the tables. AI problems leave the answer empty.
 * Only an unexpected tool error or a missing assistant permission fails the call.
 */
export async function morningBriefing(ctx: Ctx, opts: BriefingOptions = {}): Promise<Result<AssistantAnswer>> {
  const perm = requirePerm(ctx, ACTION_PERM);
  if (!perm.ok) return perm;

  const byName = new Map<AssistantToolName, AssistantTable>();
  for (const name of briefingTools(ctx)) {
    const res = await runAssistantTool(ctx, name);
    if (!res.ok) {
      if (res.error.code === 'FORBIDDEN') continue;
      return res;
    }
    byName.set(name, res.value);
  }
  const tables = BRIEFING_TOOLS.flatMap((n) => {
    const t = byName.get(n);
    return t ? [t] : [];
  });

  const answer = await writeBriefing(ctx, tables, opts.ai ?? true);

  const proposals: ActionProposal[] = [];
  const contractIds = collectionContractIds(byName.get(COLLECTIONS_TOOL));
  if (contractIds.length > 0) {
    // propose re-checks eligibility and the domain permission. Anything it refuses simply yields no proposal.
    const res = await propose(ctx, { kind: 'reminder_batch', contractIds });
    if (res.ok) proposals.push(res.value);
  }

  return ok({ answer, tables, proposals });
}
