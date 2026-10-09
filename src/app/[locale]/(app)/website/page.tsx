import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { saveSettingsForm } from '@/modules/website/actions';
import { websiteSettingsEntity } from '@/modules/website/entities';
import { getSettings } from '@/modules/website/service/settings';
import { buttonVariants } from '@/ui/primitives/button';
import { RecordForm } from '@/ui/views/record-form';
import { cn } from '@/ui/lib/cn';

export default async function WebsiteSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('website');
  const currentLocale = await getLocale();
  const result = await withPageCtx((ctx) => getSettings(ctx));

  if (!result.ok) {
    return (
      <main className="flex flex-col gap-6">
        <p role="alert" className="text-sm text-destructive">{t('settings.error')}</p>
      </main>
    );
  }
  const row = result.value;

  return (
    <main className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">{t('settings.title')}</h1>
        <div className="flex flex-wrap gap-3">
          {row ? (
            <Link href={`/${currentLocale}/shop/${row.slug}`} target="_blank" className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11')}>
              {t('settings.open_shop')}
            </Link>
          ) : null}
          <Link href={`/${currentLocale}/website/orders`} className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11')}>
            {t('orders.title')}
          </Link>
        </div>
      </header>
      <p className="max-w-2xl text-sm text-muted-foreground">{t('settings.hint')}</p>
      <div className="max-w-2xl">
        <RecordForm
          entity={websiteSettingsEntity}
          action={saveSettingsForm}
          submitLabel={t('settings.save')}
          values={
            row
              ? {
                  slug: row.slug,
                  enabled: row.enabled,
                  title: row.title,
                  about: row.about ?? '',
                  phoneWhatsapp: row.phoneWhatsapp ?? '',
                  showPrices: row.showPrices,
                }
              : { enabled: false, showPrices: true }
          }
        />
      </div>
    </main>
  );
}
