import { z } from 'zod';

/** Routes the AI may navigate to. Anything else is ignored. */
export const SEARCH_ROUTES = {
  contacts: { href: '/contacts', filters: [] },
  products: { href: '/products', filters: [] },
  contracts: { href: '/credit/contracts', filters: ['state'] },
  overdue: { href: '/credit/overdue', filters: [] },
  invoices: { href: '/invoicing/customers', filters: [] },
  sales: { href: '/sales', filters: [] },
  leads: { href: '/crm', filters: [] },
  tickets: { href: '/helpdesk', filters: [] },
} as const;

export type SearchModule = keyof typeof SEARCH_ROUTES;

/** Allowed values for each filter key. */
export const FILTER_VALUES: Record<string, readonly string[]> = {
  state: ['draft', 'active', 'completed', 'cancelled', 'defaulted'],
};

const moduleNames = Object.keys(SEARCH_ROUTES) as [SearchModule, ...SearchModule[]];

/** Shape of the JSON the AI must return. Unknown modules and filters are dropped, not rejected. */
export const aiQuerySchema = z.object({
  intent: z.enum(['navigate', 'search']),
  module: z.string().max(40).optional(),
  filters: z.record(z.string().max(40), z.string().max(60)).optional(),
  text: z.string().max(120).optional(),
});

export type AiQuery = z.infer<typeof aiQuerySchema>;

export interface ResolvedQuery {
  href: string | null;
  text: string;
}

export function buildInterpretPrompt(query: string): { system: string; user: string } {
  const routes = moduleNames
    .map((m) => `- ${m}${SEARCH_ROUTES[m].filters.length ? ` (filters: ${SEARCH_ROUTES[m].filters.join(', ')})` : ''}`)
    .join('\n');
  const system =
    'You map a short business search query to a navigation intent for a shop app. ' +
    'Reply only with a JSON object: {"intent": "navigate" | "search", "module": string?, "filters": {string: string}?, "text": string?}. ' +
    'Use "navigate" when the user names a section, "search" otherwise. Only use these modules:\n' +
    routes +
    '\nOnly use the filter keys listed for the module, with their values as-is. Never propose writes.';
  return { system, user: `Query: ${query.slice(0, 200)}` };
}

/** Turns a validated AI reply into a whitelisted URL with query params. */
export function resolveAiQuery(ai: AiQuery, fallbackText: string): ResolvedQuery {
  const text = (ai.text ?? fallbackText).trim();
  const mod = ai.module as SearchModule | undefined;
  if (!mod || !(mod in SEARCH_ROUTES)) return { href: null, text };
  const route = SEARCH_ROUTES[mod];
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(ai.filters ?? {})) {
    if (!(route.filters as readonly string[]).includes(key)) continue;
    if (!FILTER_VALUES[key]?.includes(value)) continue;
    params.set(key, value);
  }
  if (text) params.set('q', text);
  const qs = params.toString();
  return { href: qs ? `${route.href}?${qs}` : route.href, text };
}

/** Parses the raw AI reply. Returns null when it does not match the schema. */
export function parseAiQuery(raw: unknown): AiQuery | null {
  const parsed = aiQuerySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
