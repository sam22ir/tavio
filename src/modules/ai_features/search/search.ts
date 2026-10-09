import { getAi, parseJsonReply, type AiResult } from '@/core/adapters/ai';
import { assertAiQuota, recordAiUsage } from '@/core/ai/usage';
import type { Ctx } from '@/core/ctx';
import type { ListQuery } from '@/core/entities/types';
import { ok, type Result } from '@/core/result';
import { listContracts } from '@/modules/credit_sales/service/contracts';
import { listPartners } from '@/modules/contacts/service/partners';
import { listProducts } from '@/modules/products/service/products';
import { buildInterpretPrompt, parseAiQuery, resolveAiQuery } from './interpret';

export interface SearchHit {
  kind: 'contact' | 'product' | 'contract';
  label: string;
  href: string;
}

export interface SearchResponse {
  /** Whitelisted route with query params when the AI proposed one, else null. */
  href: string | null;
  source: 'ai' | 'text';
  hits: SearchHit[];
}

const PAGE: ListQuery = { page: 1, pageSize: 5, filters: {} };

/** Plain text search across contacts, products and contracts. Read-only. */
export async function textSearch(ctx: Ctx, text: string): Promise<SearchHit[]> {
  const q = { ...PAGE, q: text };
  const hits: SearchHit[] = [];
  const partners = await listPartners(ctx, q);
  if (partners.ok) {
    for (const row of partners.value.rows) {
      hits.push({ kind: 'contact', label: row.displayName, href: `/contacts/${row.id}` });
    }
  }
  const products = await listProducts(ctx, q);
  if (products.ok) {
    for (const row of products.value.rows) {
      hits.push({ kind: 'product', label: String(row.name), href: `/products/${row.id}` });
    }
  }
  const contracts = await listContracts(ctx, q);
  for (const row of contracts.rows) {
    hits.push({ kind: 'contract', label: String(row.reference), href: `/credit/contracts/${String(row.id)}` });
  }
  return hits;
}

/**
 * Interprets a query with AI (navigation intent) and always returns text hits.
 * Without AI, or on any bad reply, only the text search runs.
 */
export async function searchQuery(ctx: Ctx, query: string): Promise<Result<SearchResponse>> {
  const trimmed = query.trim();
  if (!trimmed) return ok({ href: null, source: 'text', hits: [] });

  const ai = getAi();
  if (!ai) return ok({ href: null, source: 'text', hits: await textSearch(ctx, trimmed) });

  const quota = await assertAiQuota(ctx);
  if (!quota.ok) return quota;

  let result: AiResult | null = null;
  try {
    const prompt = buildInterpretPrompt(trimmed);
    result = await ai.complete(
      [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      { feature: 'search.interpret', json: true, maxTokens: 200, temperature: 0 },
    );
  } catch {
    result = null;
  }
  if (!result) return ok({ href: null, source: 'text', hits: await textSearch(ctx, trimmed) });
  await recordAiUsage(ctx, result, 'search.interpret');

  const aiQuery = parseAiQuery(parseJsonReply(result.text));
  if (!aiQuery) return ok({ href: null, source: 'text', hits: await textSearch(ctx, trimmed) });

  const resolved = resolveAiQuery(aiQuery, trimmed);
  const hits = await textSearch(ctx, resolved.text || trimmed);
  return ok({ href: resolved.href, source: 'ai', hits });
}
