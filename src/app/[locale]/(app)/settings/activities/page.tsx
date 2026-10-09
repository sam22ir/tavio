import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { ActivitySettings } from '@/modules/chatter/ui/activity-settings';

export default async function ActivitySettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('chatter.settings');

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t('pageTitle')}</h1>
      </div>
      <ActivitySettings />
    </main>
  );
}
