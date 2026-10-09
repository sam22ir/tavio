import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { createCampaignForm } from '@/modules/marketing/actions';
import { campaignEntity } from '@/modules/marketing/entities';
import { RecordForm } from '@/ui/views/record-form';

export default async function NewCampaignPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('marketing');
  const currentLocale = await getLocale();

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <Link href={`/${currentLocale}/marketing`} className="text-sm text-muted-foreground hover:underline">
        ← {t('page.title')}
      </Link>
      <h1 className="text-xl font-semibold">{t('page.new')}</h1>
      <p className="text-sm text-muted-foreground">{t('editor.placeholdersHint')}</p>
      <div className="max-w-2xl">
        <RecordForm entity={campaignEntity} action={createCampaignForm} submitLabel={t('editor.create')} />
      </div>
    </main>
  );
}
