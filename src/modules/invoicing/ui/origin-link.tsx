import Link from 'next/link';
import type { JSX } from 'react';
import { getTranslations } from 'next-intl/server';

// Link from an invoice to the sale or purchase order it was created from. Renders nothing for manual invoices.
// Not a registry relation: the link target is the invoice's own source record, not the invoice id.
export async function InvoiceOriginLink({
  locale,
  sourceEntity,
  sourceId,
}: {
  locale: string;
  sourceEntity: string | null;
  sourceId: string | null;
}): Promise<JSX.Element | null> {
  if (sourceId === null) return null;
  const path = sourceEntity === 'sales.order' ? 'sales' : sourceEntity === 'purchases.order' ? 'purchases' : null;
  if (path === null) return null;
  const t = await getTranslations('relations');
  return (
    <Link
      href={`/${locale}/${path}/${sourceId}`}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-background px-3 text-sm hover:bg-default"
    >
      {t(path === 'sales' ? 'invoice.saleOrder' : 'invoice.purchaseOrder')}
    </Link>
  );
}
