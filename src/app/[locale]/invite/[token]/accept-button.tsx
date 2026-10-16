'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { acceptInvitationAction } from '../../(app)/settings/team/actions';
import { authClient } from '@/core/auth/client';
import { Button } from '@/ui/primitives/button';

export function AcceptButton({
  token,
  inviteEmail,
  sessionEmail,
}: {
  token: string;
  inviteEmail: string;
  sessionEmail: string;
}) {
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

  async function switchAccount() {
    try {
      await authClient.signOut();
    } finally {
      const next = encodeURIComponent(`/${locale}/invite/${token}`);
      router.push(`/${locale}/login?next=${next}&email=${encodeURIComponent(inviteEmail)}`);
      router.refresh();
    }
  }

  const mismatch = sessionEmail.trim().toLowerCase() !== inviteEmail;

  return (
    <div className="flex flex-col gap-3">
      {mismatch ? (
        <p role="alert" className="text-sm text-destructive">
          {t('invite_page.wrong_account', { email: inviteEmail })}
        </p>
      ) : null}
      {errorKey ? (
        <p role="alert" className="text-sm text-destructive">
          {t(errorKey)}
        </p>
      ) : null}
      {mismatch ? (
        <Button type="button" onClick={switchAccount} className="w-full">
          {t('invite_page.switch_account')}
        </Button>
      ) : (
        <Button type="button" onClick={onAccept} disabled={pending} className="w-full">
          {pending ? t('accept.submitting') : t('accept.submit')}
        </Button>
      )}
    </div>
  );
}
