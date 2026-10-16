import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { ensureDefaults, listJournals } from '@/modules/accounting/service/chart';
import { JournalForm } from '@/modules/accounting/ui/journal-form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/primitives/table';

export default async function JournalsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const journals = await withPageCtx(async (ctx) => {
    await ensureDefaults(ctx);
    return listJournals(ctx);
  });
  const t = await getTranslations('accounting');
  const currentLocale = await getLocale();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('journals.title')}</h1>
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{t('journals.new')}</h2>
        <JournalForm />
      </section>
        <section className="app-panel flex flex-col gap-4 p-5">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('fields.code')}</TableHead>
                  <TableHead>{t('fields.name')}</TableHead>
                  <TableHead>{t('fields.type')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journals.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-mono">
                      <Link href={`/${currentLocale}/accounting/journals/${j.id}`} className="hover:underline">{j.code}</Link>
                    </TableCell>
                    <TableCell>{j.name}</TableCell>
                    <TableCell>{t(`options.journalType.${j.type}`)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
    </div>
  );
}
