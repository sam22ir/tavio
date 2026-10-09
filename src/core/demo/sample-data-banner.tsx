'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { clearSampleData } from './actions';

/** Shows that sample data is loaded, with a two-step clear. Renders nothing when `active` is false. */
export function SampleDataBanner({ active }: { active: boolean }) {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!active) return null;

  function confirm(): void {
    startTransition(async () => {
      const res = await clearSampleData();
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
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
    >
      <span>{t('banner.active')}</span>
      {confirming ? (
        <span className="flex flex-wrap items-center gap-3">
          <span>{t('banner.confirm')}</span>
          <button type="button" onClick={confirm} disabled={pending} className="font-medium text-red-800 hover:underline disabled:opacity-50">
            {t('banner.confirmAction')}
          </button>
          <button type="button" onClick={() => setConfirming(false)} disabled={pending} className="font-medium hover:underline">
            {t('banner.cancel')}
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="font-medium hover:underline">
          {t('banner.clear')}
        </button>
      )}
      {failed && (
        <span role="alert" className="w-full text-red-800">
          {t('banner.failed')}
        </span>
      )}
    </div>
  );
}
