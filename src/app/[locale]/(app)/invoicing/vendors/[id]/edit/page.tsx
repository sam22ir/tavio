import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound, redirect } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { draftLookupsFor } from '@/modules/invoicing/queries';
import { loadInvoice } from '@/modules/invoicing/service/invoices';
import { DraftForm } from '@/modules/invoicing/ui/draft-form';
import { centsToDzdText, type DraftFormInitial } from '@/modules/invoicing/ui/draft-form-defaults';
import { formatPercent } from '@/modules/invoicing/service/math';

export default async function EditVendorInvoice({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const data = await withPageCtx(async (ctx) => {
    const loaded = await loadInvoice(ctx, id);
    if (!loaded.ok) return null;
    return { ...loaded.value, lookups: await draftLookupsFor(ctx, 'vendors') };
  });
  if (!data) notFound();
  const { invoice, lines, lookups } = data;
  const detailHref = `/${locale}/invoicing/vendors/${id}`;
  if (invoice.state !== 'draft' || (invoice.type !== 'out_invoice' && invoice.type !== 'in_invoice')) redirect(detailHref);
  const initial: DraftFormInitial = {
    id: invoice.id,
    partnerId: invoice.partnerId,
    date: String(invoice.date),
    dueDate: invoice.dueDate ? String(invoice.dueDate) : '',
    withholdingTaxId: invoice.withholdingTaxId ?? '',
    lines: lines.map((l) => ({
      key: l.id,
      productId: l.productId ?? '',
      description: l.description,
      quantity: String(l.quantity),
      unitPrice: centsToDzdText(l.unitPriceCents),
      discount: formatPercent(String(l.discountRate)),
      taxId: l.taxId ?? '',
    })),
  };
  const t = await getTranslations('invoicing');
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('editor.editTitle')}</h1>
      <DraftForm kind="vendors" locale={locale} lookups={lookups} initial={initial} />
    </div>
  );
}
