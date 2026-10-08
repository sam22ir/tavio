import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { loadShell } from '@/ui/shell/load-shell';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const shell = await loadShell(locale as Locale);
  const t = await getTranslations('shell.dashboard');

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="text-muted-foreground">{t('greeting', { company: shell.active.name })}</p>
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
        <h2 className="font-medium">{t('emptyTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('emptyBody')}</p>
      </div>
    </section>
  );
}
