import { getLocale, getTranslations } from 'next-intl/server';
import { withPageCtx } from '@/core/actions/page-ctx';
import { ACTIVITY_TYPE_SEED } from '../entities';
import { listAssignees, listActivityTypes, listPlansForEntity, listThread, todayIso } from '../service';
import { ActivityActions, Composer, ScheduleActivityForm } from './composer';
import { LaunchPlanForm } from './launch-plan';

// Server component: thread of messages and activities for one record, with composer.
// Full width, so on mobile it sits at the bottom of the page.
export async function Chatter({ entity, recordId }: { entity: string; recordId: string }) {
  const t = await getTranslations('chatter.thread');
  const ta = await getTranslations('chatter.activity');
  const tt = await getTranslations('chatter.type');
  const locale = await getLocale();
  const data = await withPageCtx(async (ctx) => ({
    items: await listThread(ctx, entity, recordId),
    assignees: await listAssignees(ctx),
    types: (await listActivityTypes(ctx)).filter((ty) => ty.active),
    plans: await listPlansForEntity(ctx, entity),
    userId: ctx.userId,
  }));
  const today = todayIso();
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'Africa/Algiers' });
  // Seed types are translated by key. Custom types show their own name.
  const typeLabel = (name: string): string =>
    ACTIVITY_TYPE_SEED.some((s) => s.key === name) ? tt(name) : name;
  const typeOptions = data.types.map((ty) => ({ id: ty.id, label: typeLabel(ty.name) }));

  return (
    <section className="flex w-full flex-col gap-4">
      <h2 className="text-lg font-semibold">{t('title')}</h2>
      <Composer entity={entity} recordId={recordId} />
      <ScheduleActivityForm
        entity={entity}
        recordId={recordId}
        currentUserId={data.userId}
        assignees={data.assignees}
        types={typeOptions}
      />
      {data.plans.length > 0 ? (
        <LaunchPlanForm
          entity={entity}
          recordId={recordId}
          currentUserId={data.userId}
          assignees={data.assignees}
          plans={data.plans.map((p) => ({ id: p.id, name: p.name }))}
        />
      ) : null}
      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((item) => {
            if (item.kind === 'message') {
              const m = item.message;
              return (
                <li key={`m-${m.id}`} className="rounded-lg border p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{m.type === 'system' ? t('system') : m.isInternal ? t('internalNote') : ''}</span>
                    <time dateTime={m.createdAt.toISOString()}>{dateFmt.format(m.createdAt)}</time>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                </li>
              );
            }
            const a = item.activity;
            const open = a.doneAt === null;
            const overdue = open && a.dueDate < today;
            return (
              <li
                key={`a-${a.id}`}
                className={`flex flex-col gap-2 rounded-lg border p-3 ${overdue ? 'border-danger' : ''}`}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">{typeLabel(item.typeName)}</span>
                  <span>{ta('dueOn', { date: a.dueDate })}</span>
                  {overdue ? <span className="font-medium text-danger">{ta('overdue')}</span> : null}
                  {!open ? <span>{ta('done')}</span> : null}
                  {!open && a.result ? <span>{ta('resultLabel', { result: a.result })}</span> : null}
                </div>
                <p className="text-sm">{a.summary}</p>
                <ActivityActions
                  id={a.id}
                  entity={entity}
                  recordId={recordId}
                  requireResult={item.requireResult}
                  open={open}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
