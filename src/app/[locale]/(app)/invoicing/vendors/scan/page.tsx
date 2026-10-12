import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { getAi } from '@/core/adapters/ai';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { partnerOptionsFor, taxOptionsFor } from '@/modules/invoicing/queries';
import { today } from '@/modules/invoicing/service/create';
import { ScanForm } from './scan-form';

export default async function ScanVendorBill({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('ai_tools');
  const visionReady = getAi()?.supportsVision === true;
  const lookups = await withPageCtx(async (ctx) => ({
    partners: await partnerOptionsFor(ctx, 'vendors'),
    taxes: await taxOptionsFor(ctx, 'vendors'),
  }));
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('scan.title')}</h1>
      {visionReady ? (
        <ScanForm lookups={lookups} today={today()} />
      ) : (
        <p className="rounded-2xl bg-surface-secondary p-4 text-sm">{t('scan.noVision')}</p>
      )}
    </div>
  );
}
