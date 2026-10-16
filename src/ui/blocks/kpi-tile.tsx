import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { TintIcon, type Tint } from '@/ui/blocks/tint';

/** One headline figure: label, big value, optional hint line, tinted icon. Becomes a link when `href` is set. */
export function KpiTile({
  label,
  value,
  hint,
  icon,
  tint = 'info',
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tint?: Tint;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm text-muted">{label}</span>
        <TintIcon icon={icon} tint={tint} className="size-9" />
      </div>
      <span className="mt-auto pt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{value}</span>
      <span className="min-h-4 text-xs text-muted">{hint}</span>
    </>
  );
  const cls = 'app-panel flex min-w-0 flex-col gap-2 rounded-3xl p-4 sm:p-5';
  return href ? (
    <Link href={href} className={`${cls} transition-shadow hover:shadow-md`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
