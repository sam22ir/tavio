import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { formatDzd } from '@/core/money';
import { buttonVariants } from '@/ui/primitives/button';
import { cn } from '@/ui/lib/cn';
import { RecordForm } from '@/ui/views/record-form';
import { Chatter } from '@/modules/chatter/ui/chatter';
import * as crm from '@/modules/crm/service';
import {
  markLostAction,
  markWonAction,
  reopenLeadAction,
  logAttemptAction,
  updateLeadFormAction,
} from '@/modules/crm/actions';
import { leadFormEntity } from '@/modules/crm/ui/form-entity';
import { LeadStatusActions } from '@/modules/crm/ui/lead-status-actions';

// Digits only: 0XXXXXXXXX becomes 213XXXXXXXXX. Returns null when the number looks invalid.
function waNumber(phone: string): string | null {
  let digits = phone.replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, '');
  if (digits.startsWith('0')) digits = `213${digits.slice(1)}`;
  return /^\d{8,15}$/.test(digits) ? digits : null;
}

export default async function LeadPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('crm.ui');
  const loc = (await getLocale()) as Locale;

  const data = await withPageCtx(async (ctx) => {
    const lead = await crm.getLead(ctx, id);
    if (!lead.ok) return null;
    const reasons = await crm.listLostReasons(ctx);
    const pipeline = await crm.ensureDefaultPipeline(ctx);
    const stages = pipeline.ok ? await crm.listStages(ctx, pipeline.value.id) : null;
    // listStages has no requirements column; leadsByStage carries it per stage.
    const groups = pipeline.ok ? await crm.leadsByStage(ctx, pipeline.value.id) : null;
    const requirements =
      groups?.ok ? (groups.value.find((g) => g.stage.id === lead.value.stageId)?.stage.requirements ?? null) : null;
    return {
      lead: lead.value,
      reasons: reasons.ok ? (reasons.value as { id: string; name: string }[]) : [],
      stages: stages?.ok ? stages.value.map((s) => ({ id: s.id, name: s.name })) : [],
      requirements,
    };
  });
  if (!data) notFound();

  const { lead, reasons, stages, requirements } = data;
  const stageName = stages.find((s) => s.id === lead.stageId)?.name ?? (lead.stageName as string | undefined);
  const cents = lead.expectedCents;
  const amount = cents === null ? '—' : formatDzd(cents, loc);
  // The edit form takes the amount as a decimal string ("1500.50").
  const expectedInput = cents === null ? '' : `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
  const phone = typeof lead.phone === 'string' && lead.phone ? lead.phone : null;
  const wa = phone ? waNumber(phone) : null;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link href={`/${locale}/crm`} className="text-sm text-muted-foreground hover:underline">
          {t('back')}
        </Link>
        <h1 className="text-xl font-semibold break-words">{String(lead.name)}</h1>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <dt className="text-muted-foreground">{t('stage')}</dt>
          <dd>{stageName ?? '—'}</dd>
          <dt className="text-muted-foreground">{t('status')}</dt>
          <dd>{String(lead.status ?? '—')}</dd>
          <dt className="text-muted-foreground">{t('expected')}</dt>
          <dd>{amount}</dd>
        </dl>
        {requirements ? (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{t('stageRequirements')}</p>
            <p className="whitespace-pre-line text-muted-foreground">{requirements}</p>
          </div>
        ) : null}
        <LeadStatusActions
          id={id}
          status={String(lead.status ?? 'open')}
          reasons={reasons}
          markWon={markWonAction}
          markLost={markLostAction}
          reopen={reopenLeadAction}
          logAttempt={logAttemptAction}
        />
        <div className="flex flex-wrap gap-2">
          {phone ? (
            <a href={`tel:${phone}`} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
              {t('call')}
            </a>
          ) : null}
          {wa ? (
            <a
              href={`https://wa.me/${wa}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
            >
              {t('whatsapp')}
            </a>
          ) : null}
          <Link
            href={`/${locale}/credit/contracts/new?lead=${encodeURIComponent(id)}`}
            className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
          >
            {t('convert')}
          </Link>
        </div>
      </header>

      <section className="flex max-w-2xl flex-col gap-3">
        <h2 className="text-base font-medium">{t('editTitle')}</h2>
        <RecordForm
          entity={leadFormEntity}
          action={updateLeadFormAction}
          values={{ ...lead, expectedRevenueCents: expectedInput }}
          hidden={{ id }}
          relationOptions={{
            stageId: stages.map((s) => ({ value: s.id, label: s.name })),
          }}
        />
      </section>

      <Chatter entity="crm.lead" recordId={id} />
    </section>
  );
}
