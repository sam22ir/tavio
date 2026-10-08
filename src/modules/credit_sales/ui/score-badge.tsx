import { getTranslations } from 'next-intl/server';
import { withPageCtx } from '@/core/actions/page-ctx';
import { latestScore } from '../service/scoring';

const TONE: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  B: 'bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-200',
  C: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  D: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  new: 'bg-muted text-muted-foreground',
};

// Server component: shows the partner's latest risk grade. Heuristic, not a credit bureau score.
export async function ScoreBadge({ partnerId }: { partnerId: string }) {
  const t = await getTranslations('credit.score');
  const latest = await withPageCtx((ctx) => latestScore(ctx, partnerId));
  const grade = latest?.grade ?? 'new';
  const title = latest ? [`${latest.score}/100`, ...latest.reasons].join('\n') : t('new');

  return (
    <span
      title={title}
      dir="ltr"
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[grade]}`}
    >
      {latest ? `${t(grade.toLowerCase() as 'a')} · ${latest.score}` : t('new')}
    </span>
  );
}
