import { eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import type { Locale } from '@/core/ctx';
import { withTenant } from '@/core/db/tenant';
import { companies } from '@/core/db/schema';
import { routing } from '@/i18n/routing';
import { loadShell } from '@/ui/shell/load-shell';

const FIELDS = [
  'legalName',
  'displayName',
  'nif',
  'nis',
  'rc',
  'ai',
  'phone',
  'email',
  'address',
  'wilayaCode',
  'defaultLocale',
  'timezone',
  'currencyCode',
] as const;

const LABEL_KEY: Record<(typeof FIELDS)[number], string> = {
  legalName: 'legalName',
  displayName: 'displayName',
  nif: 'nif',
  nis: 'nis',
  rc: 'rc',
  ai: 'ai',
  phone: 'phone',
  email: 'email',
  address: 'address',
  wilayaCode: 'wilayaCode',
  defaultLocale: 'defaultLocale',
  timezone: 'timezone',
  currencyCode: 'currency',
};

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const shell = await loadShell(locale as Locale);
  const t = await getTranslations('settings');
  const tc = await getTranslations('settings.company');

  const rows = await withTenant(shell.tenant, async (ctx) =>
    ctx.tx.select().from(companies).where(eq(companies.id, ctx.companyId)).limit(1),
  );
  const company = rows[0];

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <div className="rounded-lg border p-4">
        <h2 className="mb-4 font-medium">{tc('title')}</h2>
        {company ? (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <div key={field} className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">{tc(LABEL_KEY[field])}</dt>
                <dd className="text-sm">{String(company[field] ?? '—')}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">{tc('notFound')}</p>
        )}
      </div>
    </section>
  );
}
