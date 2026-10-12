import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { BookOpen, Briefcase, CalendarDays, Clock, CreditCard, FileText, Handshake, LifeBuoy, ListChecks, Package, Receipt, ShoppingCart, Truck, type LucideIcon } from 'lucide-react';
import { withPageCtx } from '@/core/actions/page-ctx';
import { relations } from '@/core/relations';
import '@/modules/relation-handlers';

// Icon names used by relation definitions (see RelationDef.icon).
const ICONS: Record<string, LucideIcon> = {
  BookOpen, Briefcase, CalendarDays, Clock, CreditCard, FileText, Handshake, LifeBuoy, ListChecks, Package, Receipt, ShoppingCart, Truck,
};

/**
 * Smart-button row for a detail page: compact links to related records, each with a count.
 * Zero-count and permission-hidden relations are not rendered. All counts run in one tenant transaction.
 */
export async function RelatedLinks({ source, id }: { source: string; id: string }) {
  const locale = await getLocale();
  const t = await getTranslations();
  const rows = await withPageCtx((ctx) => relations.countRelations(ctx, source, id));
  const visible = rows.filter((row) => row.count > 0);
  if (visible.length === 0) return null;

  return (
    <nav aria-label={t('relations.title')} className="flex flex-wrap gap-2">
      {visible.map(({ relation, count }) => {
        const Icon = ICONS[relation.icon] ?? FileText;
        return (
          <Link
            key={relation.id}
            href={relation.href(locale, id)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface-secondary px-3 py-1.5 text-sm hover:bg-default"
          >
            <Icon aria-hidden className="size-4 text-muted" />
            <span>{t(relation.labelKey)}</span>
            <span className="rounded-full bg-tint-neutral px-2 text-xs font-medium text-tint-neutral-fg tabular-nums">{count}</span>
          </Link>
        );
      })}
    </nav>
  );
}
