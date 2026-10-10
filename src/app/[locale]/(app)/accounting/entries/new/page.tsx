import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { ensureDefaults, listAccounts, listJournals } from '@/modules/accounting/service/chart';
import { DraftEntryForm } from '@/modules/accounting/ui/draft-entry-form';

export default async function NewEntryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const { accounts, journals } = await withPageCtx(async (ctx) => {
    await ensureDefaults(ctx);
    const list = await listAccounts(ctx, { page: 1, pageSize: 100, filters: {} });
    return { accounts: list.rows.filter((a) => !a.archived), journals: await listJournals(ctx) };
  });
  const t = await getTranslations('accounting');

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('entries.newTitle')}</h1>
      <DraftEntryForm
        accounts={accounts.map((a) => ({ code: a.code, name: a.name }))}
        journals={journals.map((j) => ({ code: j.code, name: j.name }))}
      />
    </main>
  );
}
