import Link from 'next/link';
import { ErrorToast } from '@/ui/feedback/error-toast';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { listRecipients } from '@/modules/marketing/service/campaigns';
import { RecipientsTable } from '@/modules/marketing/ui/recipients-table';

export default async function CampaignRecipientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('marketing');
  const tViews = await getTranslations('views');
  const { error: failure } = await searchParams;
  const currentLocale = await getLocale();
  const result = await withPageCtx((ctx) => listRecipients(ctx, id));
  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return (
      <div className="p-4 md:p-6">
        <p role="alert" className="text-sm text-destructive">
          {t('page.error')}
        </p>
      </div>
    );
  }
  const { campaign, rows } = result.value;
  const sent = rows.filter((r) => r.status === 'sent').length;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {failure ? <ErrorToast message={tViews('error')} /> : null}
      <Link href={`/${currentLocale}/marketing/${id}`} className="text-sm text-muted-foreground hover:underline">
        ← {campaign.name}
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t('recipients.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('recipients.progress', { sent, total: rows.length })}
        </p>
        <p className="text-sm text-muted-foreground">{t('recipients.noBulkNote')}</p>
      </header>
      <RecipientsTable campaignId={id} channel={campaign.channel} rows={rows} />
    </div>
  );
}
