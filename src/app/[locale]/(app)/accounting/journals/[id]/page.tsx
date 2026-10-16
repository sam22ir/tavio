import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { getJournalById } from '@/modules/accounting/service/chart';
import { JournalForm } from '@/modules/accounting/ui/journal-form';

export default async function JournalEditPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const journal = await withPageCtx((ctx) => getJournalById(ctx, id));
  if (!journal) notFound();
  const t = await getTranslations('accounting');

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{`${journal.code} · ${journal.name}`}</h1>
      <p className="text-sm text-muted">{t('journals.codeFixed')}</p>
      <JournalForm journal={{ id: journal.id, code: journal.code, name: journal.name, type: journal.type as 'sale' | 'purchase' | 'cash' | 'bank' | 'misc' | 'general' }} />
    </div>
  );
}
