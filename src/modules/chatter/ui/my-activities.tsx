import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { withPageCtx } from '@/core/actions/page-ctx';
import { myOpenActivities, todayIso } from '../service';
import { entityPath } from './entity-path';

// Server component: the current user's open activities (overdue first), max `limit`.
export async function MyActivities({ limit = 10 }: { limit?: number }) {
  const t = await getTranslations('chatter.activity');
  const tt = await getTranslations('chatter.type');
  const rows = await withPageCtx((ctx) => myOpenActivities(ctx, limit));
  const today = todayIso();
  // Overdue first; the query already orders by due date, so a stable sort keeps that order within each group.
  const sorted = [...rows].sort((a, b) => Number(b.dueDate < today) - Number(a.dueDate < today));

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('noActivities')}</p>;
  }

  return (
    <section className="flex w-full flex-col gap-3">
      <h2 className="text-lg font-semibold">{t('myActivities')}</h2>
      <ul className="flex flex-col gap-2">
        {sorted.map((r) => {
          const overdue = r.dueDate < today;
          const href = entityPath(r.entity, r.recordId);
          const body = (
            <>
              <span className="text-sm font-medium">{r.summary}</span>
              <span className="text-xs text-muted-foreground">{tt(r.typeName)}</span>
              <span className={`text-xs ${overdue ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                {overdue ? t('overdue') + ' · ' : ''}
                {t('dueOn', { date: r.dueDate })}
              </span>
            </>
          );
          return (
            <li key={r.id} className="rounded-lg border p-3">
              {href ? (
                <Link href={href} className="flex flex-col gap-1 hover:underline">
                  {body}
                </Link>
              ) : (
                <div className="flex flex-col gap-1">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
