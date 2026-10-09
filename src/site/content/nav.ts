/** Shared marketing navigation and footer link lists. Hrefs are locale-free: prefix them with `/{locale}`. */

export interface SiteLink {
  /** Translation key under `site.nav` (top bar) or `site.footer.links` (footer). */
  key: string;
  href: string;
}

export const NAV_LINKS: readonly SiteLink[] = [
  { key: 'features', href: '/features' },
  { key: 'solutions', href: '/solutions' },
  { key: 'pricing', href: '/pricing' },
  { key: 'onPremise', href: '/on-premise' },
  { key: 'about', href: '/about' },
  { key: 'contact', href: '/contact' },
];

export const FOOTER_COLUMNS: readonly { titleKey: 'product' | 'solutions' | 'company' | 'legal'; links: readonly SiteLink[] }[] = [
  {
    titleKey: 'product',
    links: [
      { key: 'features', href: '/features' },
      { key: 'pricing', href: '/pricing' },
      { key: 'onPremise', href: '/on-premise' },
    ],
  },
  {
    titleKey: 'solutions',
    links: [
      { key: 'solutionsIndex', href: '/solutions' },
      { key: 'electromenagerCredit', href: '/solutions/electromenager-credit' },
      { key: 'carDealers', href: '/solutions/car-dealers' },
      { key: 'clinics', href: '/solutions/clinics' },
      { key: 'trainingCenters', href: '/solutions/training-centers' },
      { key: 'retailPos', href: '/solutions/retail-pos' },
    ],
  },
  {
    titleKey: 'company',
    links: [
      { key: 'about', href: '/about' },
      { key: 'contact', href: '/contact' },
      { key: 'faq', href: '/faq' },
    ],
  },
  {
    titleKey: 'legal',
    links: [
      { key: 'privacy', href: '/legal/privacy' },
      { key: 'terms', href: '/legal/terms' },
    ],
  },
];

/** Builds a locale-prefixed site path, e.g. `localeHref('fr', '/pricing')` gives `/fr/pricing`. */
export function localeHref(locale: string, href: string): string {
  return href === '/' ? `/${locale}` : `/${locale}${href}`;
}
