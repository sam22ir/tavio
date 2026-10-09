// Solution page seeds. Copy lives in messages/*/site_pricing.json under `solutions.items`.
import type { MockVariant } from '@/site/components';
import { SOLUTION_SLUGS } from '@/site/seo';

export type SolutionSlug = (typeof SOLUTION_SLUGS)[number];

/** Module keys, translated under `solutions.modules.<key>`. */
export type SolutionModuleKey =
  | 'credit'
  | 'crm'
  | 'invoicing'
  | 'pos'
  | 'inventory'
  | 'accounting'
  | 'hr'
  | 'helpdesk'
  | 'website'
  | 'platform';

export interface SolutionSeed {
  slug: SolutionSlug;
  /** Hero mock-up. */
  variant: MockVariant;
  /** Mock-up shown next to the "how Tavio helps" text. */
  secondaryVariant: MockVariant;
}

// `satisfies Record<SolutionSlug, ...>` fails to compile if a slug from SOLUTION_SLUGS is missing.
export const SOLUTION_SEEDS = {
  'electromenager-credit': { slug: 'electromenager-credit', variant: 'installments', secondaryVariant: 'invoice' },
  'car-dealers': { slug: 'car-dealers', variant: 'kanban', secondaryVariant: 'invoice' },
  clinics: { slug: 'clinics', variant: 'dashboard', secondaryVariant: 'installments' },
  'training-centers': { slug: 'training-centers', variant: 'dashboard', secondaryVariant: 'installments' },
  'retail-pos': { slug: 'retail-pos', variant: 'pos', secondaryVariant: 'invoice' },
} satisfies Record<SolutionSlug, SolutionSeed>;

export function isSolutionSlug(value: string): value is SolutionSlug {
  return (SOLUTION_SLUGS as readonly string[]).includes(value);
}
