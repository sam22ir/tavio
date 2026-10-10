import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Briefcase, Clock, CreditCard, FileText, Handshake, LifeBuoy, ListChecks, Receipt, ShoppingCart, type LucideIcon } from 'lucide-react';
import { withPageCtx } from '@/core/actions/page-ctx';
import { relations } from '@/core/relations';
import '@/modules/relation-handlers';

// Icon names used by relation definitions (see RelationDef.icon).
const ICONS: Record<string, LucideIcon> = {
  Briefcase, Clock, CreditCard, FileText, Handshake, LifeBuoy, ListChecks, Receipt, ShoppingCart,
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
            className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-background px-3 text-sm hover:bg-muted"
          >
            <Icon aria-hidden className="size-4 text-muted-foreground" />
            <span>{t(relation.labelKey)}</span>
            <span className="rounded-full bg-muted px-2 text-xs font-medium tabular-nums">{count}</span>
          </Link>
        );
      })}
    </nav>
  );
}
