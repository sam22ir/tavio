// Solution page seeds. Copy lives in messages/*/site_pricing.json under `solutions.items`.
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
  /** Screenshot name in `public/screens/<name>-<locale>.png`. */
  screen: string;
  /** Icon name, mapped to a lucide icon on the index page. */
  icon: 'appliance' | 'car' | 'clinic' | 'training' | 'store';
}

// `satisfies Record<SolutionSlug, ...>` fails to compile if a slug from SOLUTION_SLUGS is missing.
export const SOLUTION_SEEDS = {
  'electromenager-credit': { slug: 'electromenager-credit', screen: 'contract-detail', icon: 'appliance' },
  'car-dealers': { slug: 'car-dealers', screen: 'crm-kanban', icon: 'car' },
  clinics: { slug: 'clinics', screen: 'overdue', icon: 'clinic' },
  'training-centers': { slug: 'training-centers', screen: 'invoice', icon: 'training' },
  'retail-pos': { slug: 'retail-pos', screen: 'pos', icon: 'store' },
} satisfies Record<SolutionSlug, SolutionSeed>;

export function isSolutionSlug(value: string): value is SolutionSlug {
  return (SOLUTION_SLUGS as readonly string[]).includes(value);
}
