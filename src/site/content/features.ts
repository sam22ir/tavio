import type { MockVariant } from '@/site/components/MockScreen';
import { FEATURE_SLUGS } from '@/site/seo';

export type ScreenName = 'dashboard' | 'contract-detail' | 'overdue' | 'crm-kanban' | 'invoice' | 'pos' | 'phone-dashboard';

/** Module slugs, shared with the sitemap and `generateStaticParams`. */
export type FeatureSlug = (typeof FEATURE_SLUGS)[number];

export interface FeatureDef {
  slug: FeatureSlug;
  /** Which Tavio screen mock-up illustrates the module. */
  mock: MockVariant;
  /** Real app screenshot (`public/screens/<screen>-<locale>.png`) shown on the detail page. */
  screen: ScreenName;
  /** Other modules shown at the bottom of the detail page. Never the module itself. */
  related: readonly FeatureSlug[];
}

/** Copy (title, tagline, body, capabilities) lives in `messages/<locale>/site_features.json` under `items.<slug>`. */
export const FEATURES = [
  { slug: 'credit-sales', mock: 'installments', screen: 'contract-detail', related: ['sales-invoicing', 'crm', 'accounting'] },
  { slug: 'crm', mock: 'kanban', screen: 'crm-kanban', related: ['credit-sales', 'sales-invoicing', 'website-shop'] },
  { slug: 'sales-invoicing', mock: 'invoice', screen: 'invoice', related: ['accounting', 'inventory-purchases', 'pos'] },
  { slug: 'inventory-purchases', mock: 'dashboard', screen: 'dashboard', related: ['sales-invoicing', 'accounting', 'pos'] },
  { slug: 'accounting', mock: 'dashboard', screen: 'overdue', related: ['sales-invoicing', 'inventory-purchases', 'hr'] },
  { slug: 'pos', mock: 'pos', screen: 'pos', related: ['inventory-purchases', 'sales-invoicing', 'website-shop'] },
  { slug: 'hr', mock: 'dashboard', screen: 'dashboard', related: ['accounting', 'projects-helpdesk', 'platform'] },
  { slug: 'projects-helpdesk', mock: 'kanban', screen: 'crm-kanban', related: ['crm', 'hr', 'ai'] },
  { slug: 'website-shop', mock: 'pos', screen: 'pos', related: ['pos', 'crm', 'inventory-purchases'] },
  { slug: 'ai', mock: 'dashboard', screen: 'dashboard', related: ['platform', 'crm', 'projects-helpdesk'] },
  { slug: 'platform', mock: 'dashboard', screen: 'dashboard', related: ['ai', 'website-shop', 'hr'] },
] as const satisfies readonly FeatureDef[];

export function isFeatureSlug(slug: string): slug is FeatureSlug {
  return (FEATURE_SLUGS as readonly string[]).includes(slug);
}

export function getFeature(slug: string): FeatureDef | undefined {
  return FEATURES.find((f) => f.slug === slug);
}
