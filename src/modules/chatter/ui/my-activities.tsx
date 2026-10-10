import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import type { OpenActivity } from '../service';
import { todayIso } from '../service';
import { entityPath } from './entity-path';
import {
  ACTIVITY_FILTERS,
  DEADLINE_CLASS,
  deadlineTone,
  matchesActivityFilter,
  type ActivityFilter,
} from './activity-filter';

export { parseActivityFilter, type ActivityFilter } from './activity-filter';

// Server component. `rows` are the current user's open activities (the caller loads them), overdue
// first. `filter` narrows the list by due date; the filter links point to `basePath?activities=<filter>`.
export async function MyActivities({
  rows,
  limit = 10,
  filter = 'all',
  basePath,
}: {
  rows: OpenActivity[];
  limit?: number;
  filter?: ActivityFilter;
  basePath: string;
}) {
  const t = await getTranslations('chatter.activity');
  const tt = await getTranslations('chatter.type');
  const today = todayIso();

  const counts: Record<ActivityFilter, number> = {
    all: rows.length,
    today: rows.filter((r) => matchesActivityFilter('today', r.dueDate, today)).length,
    overdue: rows.filter((r) => matchesActivityFilter('overdue', r.dueDate, today)).length,
    planned: rows.filter((r) => matchesActivityFilter('planned', r.dueDate, today)).length,
  };

  // Overdue first; the query already orders by due date, so a stable sort keeps that order within each group.
  const sorted = rows
    .filter((r) => matchesActivityFilter(filter, r.dueDate, today))
    .sort((a, b) => Number(b.dueDate < today) - Number(a.dueDate < today))
    .slice(0, limit);

  return (
    <section className="flex w-full flex-col gap-3">
      <h2 className="text-lg font-semibold">{t('myActivities')}</h2>
      <nav aria-label={t('filters.label')} className="flex flex-wrap gap-2">
        {ACTIVITY_FILTERS.map((f) => (
          <Link
            key={f}
            href={`${basePath}?activities=${f}`}
            aria-current={f === filter ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm ${
              f === filter ? 'border-primary bg-primary/10 font-medium' : 'text-muted-foreground'
            }`}
          >
            {t(`filters.${f}`)}
            <span className="tabular-nums">{counts[f]}</span>
          </Link>
        ))}
      </nav>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noActivities')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((r) => {
            const tone = deadlineTone(r.dueDate, today);
            const href = entityPath(r.entity, r.recordId);
            const body = (
              <>
                <span className="text-sm font-medium">{r.summary}</span>
                <span className="text-xs text-muted-foreground">{tt(r.typeName)}</span>
                <span className={`text-xs ${DEADLINE_CLASS[tone]}`}>
                  {tone === 'overdue' ? t('overdue') + ' · ' : tone === 'today' ? t('dueToday') + ' · ' : ''}
                  {t('dueOn', { date: r.dueDate })}
                </span>
              </>
            );
            return (
              <li key={r.id} className="min-h-11 rounded-lg border p-3">
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
      )}
    </section>
  );
}
