'use client';

import { useTranslations } from 'next-intl';

/** Triggers the browser print dialog. Hidden on paper via the no-print class. */
export function PrintButton({ label }: { label?: string }) {
  const t = useTranslations('print');
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print min-h-11 min-w-11 rounded-md border px-4 text-sm font-medium"
    >
      {label ?? t('print')}
    </button>
  );
}
