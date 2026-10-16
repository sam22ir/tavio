import { setRequestLocale, getTranslations } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import type { Locale } from '@/core/ctx';
import { withTenant } from '@/core/db/tenant';
import { getMessageSettings, listTemplates } from '@/core/messaging/service';
import { routing } from '@/i18n/routing';
import { loadShell } from '@/ui/shell/load-shell';
import { MessagingSettingsForm } from './messaging-settings-form';

export default async function MessagingSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const shell = await loadShell(locale as Locale);
  const t = await getTranslations('messaging.settings');
  const data = await withTenant(shell.tenant, async (ctx) => {
    const templates = await listTemplates(ctx);
    const settings = await getMessageSettings(ctx);
    return { templates, settings };
  });

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      {data.templates.ok ? (
        <MessagingSettingsForm templates={data.templates.value} settings={data.settings} />
      ) : (
        <p className="text-sm text-danger">{data.templates.error.message}</p>
      )}
    </section>
  );
}
