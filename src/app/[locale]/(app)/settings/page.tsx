import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import type { Locale } from '@/core/ctx';
import { withTenant } from '@/core/db/tenant';
import { companies } from '@/core/db/schema';
import { routing } from '@/i18n/routing';
import { loadShell } from '@/ui/shell/load-shell';
import { fileUrl } from '@/core/files/service';
import { CompanyForm } from './company-form';

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
  const tt = await getTranslations('team');
  const tm = await getTranslations('messaging.settings');

  const rows = await withTenant(shell.tenant, async (ctx) =>
    ctx.tx.select().from(companies).where(eq(companies.id, ctx.companyId)).limit(1),
  );
  const company = rows[0];
  const logoUrl = company?.logoFileId
    ? await withTenant(shell.tenant, (ctx) => fileUrl(ctx, company.logoFileId as string)).then((r) => (r.ok ? r.value : null))
    : null;

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <Link href={`/${locale}/settings/team`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        {tt('settings_link')}
      </Link>
      <Link href={`/${locale}/settings/fiscal-years`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        {t('fiscalYearsLink')}
      </Link>
      <Link href={`/${locale}/settings/messaging`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        {tm('nav')}
      </Link>
      <Link href={`/${locale}/settings/messages`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        {tm('messagesLog')}
      </Link>
      <div className="rounded-lg border p-4">
        <h2 className="mb-4 font-medium">{tc('title')}</h2>
        {company ? (
          <CompanyForm
            values={{
              legalName: company.legalName,
              displayName: company.displayName,
              address: company.address ?? '',
              wilayaCode: company.wilayaCode ?? '',
              phone: company.phone ?? '',
              email: company.email ?? '',
              nif: company.nif ?? '',
              nis: company.nis ?? '',
              rc: company.rc ?? '',
              ai: company.ai ?? '',
              rib: company.rib ?? '',
              ccp: company.ccp ?? '',
              logoUrl: logoUrl,
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{tc('notFound')}</p>
        )}
      </div>
    </section>
  );
}
