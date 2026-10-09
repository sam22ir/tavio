import type { MetadataRoute } from 'next';
import { DISALLOWED_APP_SEGMENTS, SITE_URL } from '@/site/seo';

export default function robots(): MetadataRoute.Robots {
  const appPaths = DISALLOWED_APP_SEGMENTS.map((s) => `/*/${s}`);
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', ...appPaths, '/*/invite/', '/*/shop/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
