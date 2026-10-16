import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { RecordForm } from '@/ui/views/record-form';
import * as crm from '@/modules/crm/service';
import { createLeadFormAction } from '@/modules/crm/actions';
import { leadFormEntity } from '@/modules/crm/ui/form-entity';

export default async function NewLeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const sp = await searchParams;
  const requested = typeof sp.pipeline === 'string' ? sp.pipeline : undefined;
  const t = await getTranslations('crm.ui');
  // The pipeline picked here decides the stage options; the lead is created in the stage's pipeline.
  const pipeline = await withPageCtx(async (ctx) => {
    const pipelines = await crm.listPipelines(ctx);
    if (!pipelines.ok) return null;
    const selected =
      pipelines.value.find((p) => p.id === requested) ??
      pipelines.value.find((p) => p.isDefault) ??
      pipelines.value[0];
    if (!selected) return null;
    const s = await crm.listStages(ctx, selected.id);
    if (!s.ok) return null;
    return {
      pipelines: pipelines.value,
      pipelineId: selected.id,
      stages: s.value.map((x) => ({ id: x.id, name: x.name })),
    };
  });

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t('newTitle')}</h1>
      {pipeline ? (
        <>
          <form method="get" className="flex items-center gap-2 text-sm">
            <label htmlFor="pipeline-select">{t('pipelineFilter')}</label>
            <select id="pipeline-select" name="pipeline" defaultValue={pipeline.pipelineId}>
              {pipeline.pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button type="submit" className="h-9 rounded-2xl border border-separator px-3">
              {t('applyFilter')}
            </button>
          </form>
        <RecordForm
          entity={leadFormEntity}
          action={createLeadFormAction}
          values={{ type: 'lead', stageId: pipeline.stages[0]?.id }}
          relationOptions={{
            stageId: pipeline.stages.map((s) => ({ value: s.id, label: s.name })),
          }}
        />
        </>
      ) : (
        <p role="alert" className="rounded-2xl bg-tint-danger p-4 text-sm text-tint-danger-fg">
          {t('loadError')}
        </p>
      )}
    </section>
  );
}
