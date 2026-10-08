'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createAuthClient } from 'better-auth/react';
import { Button } from '@/ui/primitives/button';

export function UserMenu({ email }: { email: string }) {
  const t = useTranslations('shell');
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await createAuthClient().signOut();
    } finally {
      router.push(`/${locale}/login`);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="truncate text-xs text-muted-foreground" title={email}>
        <span className="sr-only">{t('user.loggedInAs')} </span>
        {email}
      </p>
      <Button variant="outline" size="sm" onClick={logout} disabled={pending}>
        {t('user.logout')}
      </Button>
    </div>
  );
}
