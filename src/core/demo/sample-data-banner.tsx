'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { switchCompany } from '@/ui/shell/actions';
import { archiveDemoCompanyAction } from './actions';

/**
 * Shown only inside a demo company: says where the real data is, switches back to it, and archives the demo.
 * Renders nothing when `demo` is false.
 */
export function SampleDataBanner({
  demo,
  demoCompanyId,
  realCompany,
}: {
  demo: boolean;
  demoCompanyId: string;
  realCompany: { id: string; name: string } | null;
}) {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!demo) return null;

  function switchToReal(): void {
    if (!realCompany) return;
    const target = realCompany.id;
    startTransition(async () => {
      const res = await switchCompany(target);
      if (!res.ok) {
        setFailed(true);
        return;
      }
      router.refresh();
    });
  }

  function archive(): void {
    startTransition(async () => {
      const res = await archiveDemoCompanyAction(demoCompanyId);
      if (!res.ok) {
        setFailed(true);
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-tint-warning px-4 py-2 text-sm text-tint-warning-fg"
    >
      <span>{realCompany ? t('banner.demoActive', { company: realCompany.name }) : t('banner.demoOnly')}</span>
      <span className="flex flex-wrap items-center gap-3">
        {realCompany && (
          <button type="button" onClick={switchToReal} disabled={pending} className="font-medium hover:underline disabled:opacity-50">
            {t('banner.switchToReal')}
          </button>
        )}
        {confirming ? (
          <span className="flex flex-wrap items-center gap-3">
            <span>{t('banner.archiveConfirm')}</span>
            <button type="button" onClick={archive} disabled={pending} className="font-medium text-danger hover:underline disabled:opacity-50">
              {t('banner.confirmAction')}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={pending} className="font-medium hover:underline">
              {t('banner.cancel')}
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="font-medium hover:underline">
            {t('banner.archive')}
          </button>
        )}
      </span>
      {failed && (
        <span role="alert" className="w-full text-danger">
          {t('banner.failed')}
        </span>
      )}
    </div>
  );
}
