import { setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { requirePortalSession } from '@/core/portal/session-cookie';
import { portalCtx } from '@/core/portal/context';
import { partnerOwnsContract } from '@/core/portal/queries';
import { loadContractPrint } from '@/modules/credit_sales/print/queries';
import { labels } from '@/modules/credit_sales/print/shared';
import { ContractView } from '@/modules/credit_sales/print/views';
import { PrintButton } from '@/ui/print/print-button';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PortalContractPrintPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale) || !UUID_RE.test(id)) notFound();
  setRequestLocale(locale);
  const session = await requirePortalSession(locale);

  const input = await portalCtx(session, locale as 'fr' | 'ar' | 'en', async (scope) => {
    if (!(await partnerOwnsContract(scope, id))) return null;
    return loadContractPrint(scope.ctx, id);
  });
  if (!input) notFound();

  const t = labels(locale as 'fr' | 'ar' | 'en');
  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden"><PrintButton label={t.printButton} /></div>
      <ContractView input={input} />
    </div>
  );
}
