import { getTranslations } from 'next-intl/server';
import { withPageCtx } from '@/core/actions/page-ctx';
import { ACTIVITY_TYPE_SEED } from '../entities';
import { listActivityTypes, listAssignees, listPlans } from '../service';
import { ActivityTypesEditor, PlansEditor } from './activity-settings-forms';

// Server component for the activity settings page: activity types and activity plans.
// The route page (app/[locale]/(app)/settings/activities) renders it. It is not part of this module yet.
export async function ActivitySettings() {
  const t = await getTranslations('chatter.settings');
  const tt = await getTranslations('chatter.type');
  const data = await withPageCtx(async (ctx) => ({
    types: await listActivityTypes(ctx),
    plans: await listPlans(ctx),
    assignees: await listAssignees(ctx),
  }));
  const typeLabel = (name: string): string =>
    ACTIVITY_TYPE_SEED.some((s) => s.key === name) ? tt(name) : name;
  const types = data.types.map((ty) => ({ ...ty, label: typeLabel(ty.name) }));

  return (
    <div className="flex w-full flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('typesTitle')}</h2>
        <ActivityTypesEditor types={types} assignees={data.assignees} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('plansTitle')}</h2>
        <PlansEditor
          plans={data.plans}
          types={types.filter((ty) => ty.active).map((ty) => ({ id: ty.id, label: ty.label }))}
          assignees={data.assignees}
        />
      </section>
    </div>
  );
}
