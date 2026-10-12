import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { buildRecipientsForm, queueCampaignEmailsForm, updateCampaignForm } from '@/modules/marketing/actions';
import { campaignDeliveryCounts } from '@/core/messaging/service';
import { campaignEntity } from '@/modules/marketing/entities';
import { campaignFormValues, getCampaign, listRecipients } from '@/modules/marketing/service/campaigns';
import { isEditable } from '@/modules/marketing/service/message';
import { MessagePreview } from '@/modules/marketing/ui/message-preview';
import { Chatter } from '@/modules/chatter/ui/chatter';
import { Badge } from '@/ui/primitives/badge';
import { Button, buttonVariants } from '@/ui/primitives/button';
import { RecordForm } from '@/ui/views/record-form';
import { cn } from '@/ui/lib/cn';

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('marketing');
  const currentLocale = await getLocale();
  const listHref = `/${currentLocale}/marketing`;

  const result = await withPageCtx((ctx) => getCampaign(ctx, id));
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
  const campaign = result.value;
  const editable = isEditable(campaign.state);

  // Preview uses the recipient list's shop name and a sample first name.
  const preview = await withPageCtx((ctx) => listRecipients(ctx, id));
  const shop = preview.ok ? preview.value.shop : '';
  const sampleName = t('editor.sampleName');

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Link href={listHref} className="text-sm text-muted-foreground hover:underline">
        ← {t('page.title')}
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold break-words">{campaign.name}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{t(`options.channel.${campaign.channel}`)}</Badge>
          <Badge variant="outline">{t(`options.state.${campaign.state}`)}</Badge>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t('editor.preview')}</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <MessagePreview label={t('fields.messageFr')} template={campaign.messageFr} name={sampleName} shop={shop} />
          <MessagePreview label={t('fields.messageAr')} template={campaign.messageAr} name={sampleName} shop={shop} />
        </div>
      </section>

      {campaign.channel === 'email' ? (
        <EmailDelivery id={id} editable={editable} />
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t('recipients.title')}</h2>
        <div className="flex flex-wrap gap-2">
          {editable ? (
            <form action={buildRecipientsForm}>
              <input type="hidden" name="id" value={id} />
              <Button type="submit">{t('editor.buildRecipients')}</Button>
            </form>
          ) : null}
          <Link href={`/${currentLocale}/marketing/${id}/recipients`} className={cn(buttonVariants({ variant: 'outline' }))}>
            {t('recipients.open')}
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">{t('editor.buildHint')}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t('editor.details')}</h2>
        {editable ? (
          <div className="max-w-2xl">
            <RecordForm
              entity={campaignEntity}
              values={campaignFormValues(campaign)}
              action={updateCampaignForm}
              hidden={{ id }}
              submitLabel={t('editor.save')}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('editor.locked')}</p>
        )}
      </section>

      <Chatter entity="marketing.campaign" recordId={id} />
    </div>
  );
}

async function EmailDelivery({ id, editable }: { id: string; editable: boolean }) {
  const te = await getTranslations('messaging.campaign');
  const counts = await withPageCtx((ctx) => campaignDeliveryCounts(ctx, id));
  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {te('counts', { sent: counts.sent, failed: counts.failed, manual: counts.manual, queued: counts.queued })}
      </p>
      {editable ? (
        <form action={queueCampaignEmailsForm}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit">{te('sendEmails')}</Button>
        </form>
      ) : null}
    </section>
  );
}
