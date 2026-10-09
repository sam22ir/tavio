'use client';

import { useTranslations } from 'next-intl';

export function PrintButton() {
  const t = useTranslations('sales');
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="min-h-11 min-w-11 rounded-md border px-4 text-sm font-medium print:hidden"
    >
      {t('actions.print')}
    </button>
  );
}
