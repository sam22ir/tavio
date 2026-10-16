import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { listDocumentRequirements } from '@/modules/credit_sales/service/documents';
import { DocumentRequirementsSettings } from '@/modules/credit_sales/ui/document-requirements-settings';

export default async function DocumentRequirementsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('credit');

  const res = await withPageCtx((ctx) => listDocumentRequirements(ctx));
  if (!res.ok) notFound();

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('requirements.title')}</h1>
      <DocumentRequirementsSettings rows={res.value} />
    </section>
  );
}
