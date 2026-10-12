import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ListQuery } from '@/core/entities/types';
import { toSearchParams } from '@/core/entities/list-query';
import { buttonVariants } from '@/ui/primitives/button';
import { cn } from '@/ui/lib/cn';

interface PaginationProps {
  basePath: string;
  query: ListQuery;
  total: number;
}

function hrefFor(basePath: string, query: ListQuery, page: number): string {
  const params = toSearchParams({ ...query, page });
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function Pagination({ basePath, query, total }: PaginationProps) {
  const t = useTranslations();
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const current = Math.min(query.page, pageCount);
  const hasPrev = current > 1;
  const hasNext = current < pageCount;

  const linkClass = (enabled: boolean) =>
    cn(buttonVariants({ variant: 'outline', size: 'sm' }), !enabled && 'pointer-events-none opacity-50');

  return (
    <nav aria-label={t('views.page')} className="flex items-center justify-between gap-2 py-3 text-sm">
      <Link
        href={hrefFor(basePath, query, current - 1)}
        aria-disabled={!hasPrev}
        tabIndex={hasPrev ? undefined : -1}
        className={linkClass(hasPrev)}
      >
        {t('views.prev')}
      </Link>
      <span className="text-sm text-muted tabular-nums">
        {t('views.page')} {current} / {pageCount}
      </span>
      <Link
        href={hrefFor(basePath, query, current + 1)}
        aria-disabled={!hasNext}
        tabIndex={hasNext ? undefined : -1}
        className={linkClass(hasNext)}
      >
        {t('views.next')}
      </Link>
    </nav>
  );
}
