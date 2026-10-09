import type { MockVariant } from '@/site/components/MockScreen';
import { FEATURE_SLUGS } from '@/site/seo';

/** Module slugs, shared with the sitemap and `generateStaticParams`. */
export type FeatureSlug = (typeof FEATURE_SLUGS)[number];

export interface FeatureDef {
  slug: FeatureSlug;
  /** Which Tavio screen mock-up illustrates the module. */
  mock: MockVariant;
  /** Other modules shown at the bottom of the detail page. Never the module itself. */
  related: readonly FeatureSlug[];
}

/** Copy (title, tagline, body, capabilities) lives in `messages/<locale>/site_features.json` under `items.<slug>`. */
export const FEATURES = [
  { slug: 'credit-sales', mock: 'installments', related: ['sales-invoicing', 'crm', 'accounting'] },
  { slug: 'crm', mock: 'kanban', related: ['credit-sales', 'sales-invoicing', 'website-shop'] },
  { slug: 'sales-invoicing', mock: 'invoice', related: ['accounting', 'inventory-purchases', 'pos'] },
  { slug: 'inventory-purchases', mock: 'dashboard', related: ['sales-invoicing', 'accounting', 'pos'] },
  { slug: 'accounting', mock: 'dashboard', related: ['sales-invoicing', 'inventory-purchases', 'hr'] },
  { slug: 'pos', mock: 'pos', related: ['inventory-purchases', 'sales-invoicing', 'website-shop'] },
  { slug: 'hr', mock: 'dashboard', related: ['accounting', 'projects-helpdesk', 'platform'] },
  { slug: 'projects-helpdesk', mock: 'kanban', related: ['crm', 'hr', 'ai'] },
  { slug: 'website-shop', mock: 'pos', related: ['pos', 'crm', 'inventory-purchases'] },
  { slug: 'ai', mock: 'dashboard', related: ['platform', 'crm', 'projects-helpdesk'] },
  { slug: 'platform', mock: 'dashboard', related: ['ai', 'website-shop', 'hr'] },
] as const satisfies readonly FeatureDef[];

export function isFeatureSlug(slug: string): slug is FeatureSlug {
  return (FEATURE_SLUGS as readonly string[]).includes(slug);
}

export function getFeature(slug: string): FeatureDef | undefined {
  return FEATURES.find((f) => f.slug === slug);
}
