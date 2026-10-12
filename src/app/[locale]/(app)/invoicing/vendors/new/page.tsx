import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { today } from '@/modules/invoicing/service/create';
import { draftLookupsFor } from '@/modules/invoicing/queries';
import { DraftForm } from '@/modules/invoicing/ui/draft-form';
import { emptyDraftForm } from '@/modules/invoicing/ui/draft-form-defaults';

export default async function NewVendorInvoice({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const lookups = await withPageCtx((ctx) => draftLookupsFor(ctx, 'vendors'));
  const t = await getTranslations('invoicing');
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('list.newVendor')}</h1>
      <DraftForm kind="vendors" locale={locale} lookups={lookups} initial={emptyDraftForm(today())} />
    </div>
  );
}
