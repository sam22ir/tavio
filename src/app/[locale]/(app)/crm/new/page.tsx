import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { RecordForm } from '@/ui/views/record-form';
import * as crm from '@/modules/crm/service';
import { createLeadFormAction } from '@/modules/crm/actions';
import { leadFormEntity } from '@/modules/crm/ui/form-entity';

export default async function NewLeadPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('crm.ui');
  const pipeline = await withPageCtx(async (ctx) => {
    const p = await crm.ensureDefaultPipeline(ctx);
    if (!p.ok) return null;
    const s = await crm.listStages(ctx, p.value.id);
    return s.ok ? { stages: s.value.map((x) => ({ id: x.id, name: x.name })) } : null;
  });

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">{t('newTitle')}</h1>
      {pipeline ? (
        <RecordForm
          entity={leadFormEntity}
          action={createLeadFormAction}
          values={{ type: 'lead', stageId: pipeline.stages[0]?.id }}
          relationOptions={{
            stageId: pipeline.stages.map((s) => ({ value: s.id, label: s.name })),
          }}
        />
      ) : (
        <p role="alert" className="rounded-md border p-4 text-sm text-destructive">
          {t('loadError')}
        </p>
      )}
    </section>
  );
}
