import Link from 'next/link';
import type { JSX } from 'react';
import { getTranslations } from 'next-intl/server';

// Link from a purchase order to the credit contract that created it. Renders nothing for manual orders.
export async function SourceContractLink({
  locale,
  sourceEntity,
  sourceId,
}: {
  locale: string;
  sourceEntity: string | null;
  sourceId: string | null;
}): Promise<JSX.Element | null> {
  if (sourceEntity !== 'credit_sales.contract' || sourceId === null) return null;
  const t = await getTranslations('purchases');
  return (
    <p className="text-sm text-muted">
      {t('order.sourceContract')}:{' '}
      <Link href={`/${locale}/credit/contracts/${sourceId}`} className="text-primary underline-offset-4 hover:underline">
        {t('order.openContract')}
      </Link>
    </p>
  );
}
