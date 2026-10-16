import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { requirePerm } from '@/core/perms';
import { routing } from '@/i18n/routing';
import { ActivitySettings } from '@/modules/chatter/ui/activity-settings';

export default async function ActivitySettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('chatter.settings');
  const allowed = await withPageCtx(async (ctx) => requirePerm(ctx, 'chatter.activity.write').ok);

  if (!allowed) {
    return (
      <div className="flex flex-col gap-6">
        <p role="alert" className="text-sm text-danger">{t('forbidden')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('pageTitle')}</h1>
      </div>
      <ActivitySettings />
    </div>
  );
}
