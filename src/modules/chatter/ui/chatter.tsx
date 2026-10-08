import { getLocale, getTranslations } from 'next-intl/server';
import { withPageCtx } from '@/core/actions/page-ctx';
import { listAssignees, listThread, todayIso } from '../service';
import { Composer, MarkDoneButton, ScheduleActivityForm } from './composer';

// Server component: thread of messages and activities for one record, with composer.
// Full width, so on mobile it sits at the bottom of the page.
export async function Chatter({ entity, recordId }: { entity: string; recordId: string }) {
  const t = await getTranslations('chatter.thread');
  const ta = await getTranslations('chatter.activity');
  const locale = await getLocale();
  const data = await withPageCtx(async (ctx) => ({
    items: await listThread(ctx, entity, recordId),
    assignees: await listAssignees(ctx),
    userId: ctx.userId,
  }));
  const today = todayIso();
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'Africa/Algiers' });

  return (
    <section className="flex w-full flex-col gap-4">
      <h2 className="text-lg font-semibold">{t('title')}</h2>
      <Composer entity={entity} recordId={recordId} />
      <ScheduleActivityForm entity={entity} recordId={recordId} currentUserId={data.userId} assignees={data.assignees} />
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
                className={`flex flex-col gap-2 rounded-lg border p-3 ${overdue ? 'border-destructive' : ''}`}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">{item.typeName}</span>
                  <span>{ta('dueOn', { date: a.dueDate })}</span>
                  {overdue ? <span className="font-medium text-destructive">{ta('overdue')}</span> : null}
                  {!open ? <span>{ta('done')}</span> : null}
                </div>
                <p className="text-sm">{a.summary}</p>
                {open ? (
                  <div className="flex justify-end">
                    <MarkDoneButton id={a.id} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

