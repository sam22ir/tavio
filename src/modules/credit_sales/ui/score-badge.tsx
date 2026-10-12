import { getTranslations } from 'next-intl/server';
import { withPageCtx } from '@/core/actions/page-ctx';
import { latestScore } from '../service/scoring';

const TONE: Record<string, string> = {
  A: 'bg-tint-success text-tint-success-fg',
  B: 'bg-tint-success text-tint-success-fg',
  C: 'bg-tint-warning text-tint-warning-fg',
  D: 'bg-tint-danger text-tint-danger-fg',
  new: 'bg-default text-muted-foreground',
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
