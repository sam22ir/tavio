import type { MetadataRoute } from 'next';
import { MARKETING_PATHS, SITE_LOCALES, buildAlternates, localizedUrl } from '@/site/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  return MARKETING_PATHS.flatMap((path) =>
    SITE_LOCALES.map((locale) => ({
      url: localizedUrl(locale, path),
      lastModified: new Date(),
      changeFrequency: path === '' ? 'weekly' : 'monthly',
      priority: path === '' ? 1 : 0.7,
      alternates: { languages: buildAlternates(path) },
    })),
  );
}
