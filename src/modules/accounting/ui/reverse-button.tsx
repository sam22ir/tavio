'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { reverseEntryButton } from '../actions';
import { Button } from '@/ui/primitives/button';

// Posts a reversal of a posted entry. Posted entries are never edited.
export function ReverseButton({ entryId }: { entryId: string }) {
  const t = useTranslations('accounting');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await reverseEntryButton(entryId);
          if (result && result.ok === false) toast.error(t('errors.generic'));
          else router.refresh();
        })
      }
    >
      {t('detail.reverse')}
    </Button>
  );
}
