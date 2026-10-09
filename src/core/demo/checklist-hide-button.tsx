'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CHECKLIST_HIDDEN_COOKIE } from './checklist-cookie';

/** Hides the getting-started checklist for this browser by setting a one-year cookie. */
export function ChecklistHideButton() {
  const t = useTranslations('onboarding.checklist');
  const router = useRouter();

  function hide(): void {
    try {
      document.cookie = `${CHECKLIST_HIDDEN_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
    } catch {
      // Cookies blocked: the checklist stays visible.
      return;
    }
    router.refresh();
  }

  return (
    <button type="button" onClick={hide} className="shrink-0 text-xs font-medium text-muted-foreground hover:underline">
      {t('hide')}
    </button>
  );
}
