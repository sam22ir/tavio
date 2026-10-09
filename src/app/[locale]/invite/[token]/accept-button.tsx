'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { acceptInvitationAction } from '../../(app)/settings/team/actions';
import { Button } from '@/ui/primitives/button';

export function AcceptButton({ token }: { token: string }) {
  const t = useTranslations('team');
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function onAccept() {
    setPending(true);
    setErrorKey(null);
    try {
      const result = await acceptInvitationAction(token);
      if (!result.ok) {
        setErrorKey(result.key);
        return;
      }
      router.push(`/${locale}/dashboard`);
      router.refresh();
    } catch {
      setErrorKey('errors.generic');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {errorKey ? (
        <p role="alert" className="text-sm text-destructive">
          {t(errorKey)}
        </p>
      ) : null}
      <Button type="button" onClick={onAccept} disabled={pending} className="w-full">
        {pending ? t('accept.submitting') : t('accept.submit')}
      </Button>
    </div>
  );
}
