'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { prepareG50Action, validateG50Action } from '@/modules/l10n_dz/actions';
import { Button } from '@/ui/primitives/button';

export function G50Actions({ year, month, state }: { year: number; month: number; state: 'none' | 'draft' | 'validated' }) {
  const t = useTranslations('l10n');
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(kind: 'prepare' | 'validate') {
    start(async () => {
      const r = kind === 'prepare' ? await prepareG50Action({ year, month }) : await validateG50Action({ year, month });
      if (!r.ok) {
        const key = r.error.details?.messageKey;
        toast.error(key === 'l10n.g50.period_locked' ? t('g50.period_locked') : t('taxes.error'));
        return;
      }
      toast.success(kind === 'prepare' ? t('g50.prepared') : t('g50.validated_ok'));
      router.refresh();
    });
  }

  if (state === 'validated') return null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" className="min-h-11 md:min-h-9" onClick={() => run('prepare')} disabled={pending}>
        {t('g50.prepare')}
      </Button>
      {state === 'draft' ? (
        <Button type="button" className="min-h-11 md:min-h-9" onClick={() => run('validate')} disabled={pending}>
          {t('g50.validate')}
        </Button>
      ) : null}
    </div>
  );
}
