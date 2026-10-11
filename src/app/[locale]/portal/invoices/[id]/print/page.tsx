import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { requirePortalSession } from '@/core/portal/session-cookie';
import { portalCtx } from '@/core/portal/context';
import { partnerOwnsPostedInvoice } from '@/core/portal/queries';
import { loadInvoice } from '@/modules/invoicing/service/invoices';
import { companyIdentityOf, partnerIdentity } from '@/modules/invoicing/queries';
import { DocumentLayout } from '@/ui/print/document-layout';
import { documentLabels } from '@/ui/print/labels';
import { PrintButton } from '@/ui/print/print-button';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Portal-safe print view: the same DocumentLayout as the staff print, behind the portal session and partner check.
export default async function PortalInvoicePrintPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale) || !UUID_RE.test(id)) notFound();
  setRequestLocale(locale);
  const session = await requirePortalSession(locale);

  const data = await portalCtx(session, locale as 'fr' | 'ar' | 'en', async (scope) => {
    if (!(await partnerOwnsPostedInvoice(scope, id))) return null;
    const loaded = await loadInvoice(scope.ctx, id);
    if (!loaded.ok) return null;
    const [company, buyer] = await Promise.all([companyIdentityOf(scope.ctx), partnerIdentity(scope.ctx, scope.partnerId)]);
    if (!company || !buyer) return null;
    return { ...loaded.value, company, buyer };
  });
  if (!data) notFound();
  const { invoice, lines, company, buyer } = data;
  const t = await getTranslations('print');
  const isCredit = invoice.type === 'out_refund';
  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden"><PrintButton /></div>
      <DocumentLayout
        locale={locale as 'fr' | 'ar' | 'en'}
        labels={documentLabels((k) => t(k))}
        title={t(isCredit ? 'creditNote' : 'invoice')}
        number={invoice.number ?? ''}
        date={String(invoice.date)}
        dueDate={invoice.dueDate ? String(invoice.dueDate) : null}
        company={company}
        party={buyer}
        partyRole="buyer"
        lines={lines.map((l) => ({
          description: l.description,
          quantity: String(l.quantity),
          unitPriceCents: l.unitPriceCents,
          discountRate: String(l.discountRate),
          ratePercent: String(Number(l.taxRate)),
          subtotalCents: l.subtotalCents,
          taxCents: l.taxCents,
        }))}
        totals={{
          untaxedCents: invoice.untaxedCents,
          taxCents: invoice.taxCents,
          stampCents: invoice.stampCents,
          totalCents: invoice.totalCents,
          withholdingCents: invoice.withholdingCents,
          paidCents: invoice.paidCents,
        }}
      />
    </div>
  );
}
