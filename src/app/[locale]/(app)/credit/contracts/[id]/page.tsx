import { RelatedLinks } from '@/ui/views/related-links';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { formatDzd, type Cents } from '@/core/money';
import { getContract } from '@/modules/credit_sales/service/contracts';
import { listContractDocuments } from '@/modules/credit_sales/service/documents';
import { listGuarantors } from '@/modules/credit_sales/service/guarantors';
import { listMembers } from '@/core/tenancy/members';
import { CONTRACT_SOURCE_ENTITY, sourceDeliveryStatus } from '@/modules/inventory/service/deliveries';
import { ContractWorkflowSections } from '@/modules/credit_sales/ui/contract-workflow-sections';
import { GuarantorsSection } from '@/modules/credit_sales/ui/guarantors-section';
import { WorkflowBar } from '@/modules/credit_sales/ui/workflow-bar';
import { MoreActions } from '@/ui/blocks/more-actions';
import { Panel } from '@/ui/blocks/feed';
import { StatusChip } from '@/ui/blocks/tint';
import { can } from '@/core/perms';
import { contractDebitState, getMandate, isMissingTableError } from '@/modules/credit_sales/service/debits';
import { maskCcpAccount } from '@/modules/credit_sales/service/debit-file';
import { MandateForm } from '@/modules/credit_sales/ui/debit-controls';
import { ScoreBadge } from '@/modules/credit_sales/ui/score-badge';
import { RecordPaymentButton } from '@/modules/credit_sales/ui/record-payment';
import { InstallmentsTable } from '@/modules/credit_sales/ui/installments-table';
import { Chatter } from '@/modules/chatter/ui/chatter';
import { Button } from '@/ui/primitives/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/primitives/card';
import { ContractActions } from './contract-actions';
import { PortalShareButton } from '@/core/portal/ui/portal-share-button';
import { SendMessageButton } from '@/core/messaging/ui/send-message-button';

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('credit');

  const res = await withPageCtx((ctx) => getContract(ctx, id));
  if (!res.ok) notFound();
  const { contract, partner, installments, payments, receipts, totals } = res.value;
  const workflow = await withPageCtx(async (ctx) => {
    const docs = await listContractDocuments(ctx, id);
    if (!docs.ok) return docs;
    const members = await listMembers(ctx.companyId);
    const guarantors = await listGuarantors(ctx, id);
    if (!guarantors.ok) return guarantors;
    return { ok: true as const, value: { docs: docs.value, members, guarantors: guarantors.value } };
  });
  if (!workflow.ok) notFound();
  const deliveryRes = await withPageCtx((ctx) =>
    sourceDeliveryStatus(ctx, { sourceEntity: CONTRACT_SOURCE_ENTITY, sourceId: id }),
  );
  // The debit tables arrive with migration 0020. Own transaction, so a missing table (only that error) must not take the contract page down.
  const debit = await withPageCtx(async (ctx) => ({
    mandate: await getMandate(ctx, id),
    state: await contractDebitState(ctx, id),
    canWrite: can(ctx.perms, 'credit_sales.payment.write'),
  })).catch((e: unknown) => {
    if (isMissingTableError(e)) return null;
    throw e;
  });
  const tInv = await getTranslations('inventory');
  const fmt = (c: Cents) => formatDzd(c, locale as 'fr' | 'ar' | 'en');
  const receiptByPayment = new Map(receipts.map((r) => [r.paymentId, r]));
  const base = `/${locale}/credit/contracts`;

  const statusLabels = {
    upcoming: t('contract.status.upcoming'),
    partial: t('contract.status.partial'),
    paid: t('contract.status.paid'),
    late: t('contract.status.late'),
  };
  const stateLabel = t(`options.state.${contract.state}`);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{contract.reference}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border px-2 py-0.5">{stateLabel}</span>
            <Link href={`/${locale}/contacts/${partner.id}`} className="underline">{partner.name}</Link>
            <ScoreBadge partnerId={partner.id} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ContractActions contractId={contract.id} state={contract.state} />
          <WorkflowBar contractId={contract.id} state={contract.state} />
          {contract.state === 'active' ? (
            <RecordPaymentButton contractId={contract.id} remainingCents={totals.remainingCents.toString()} openDebits={debit?.state.open ?? 0} />
          ) : null}
          <MoreActions label={t('contract.more')}>
            {contract.state !== 'draft' ? <PortalShareButton mode="document" kind="contract" id={contract.id} /> : null}
            {contract.state !== 'draft' ? <SendMessageButton entity="credit_sales.contract" recordId={contract.id} partnerId={contract.partnerId} templateKey="contract_sent" /> : null}
            {contract.state !== 'draft' ? <SendMessageButton entity="credit_sales.contract" recordId={contract.id} partnerId={contract.partnerId} templateKey="portal_invite" invite /> : null}
            <Button asChild variant="outline">
              <Link href={`${base}/${contract.id}/print`}>{t('contract.print')}</Link>
            </Button>
          </MoreActions>
        </div>
      </header>
      <RelatedLinks source="credit_sales.contract" id={id} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">{t('totals.financed')}</CardTitle></CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums">{fmt(totals.financedCents)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">{t('totals.paid')}</CardTitle></CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums">{fmt(totals.paidCents)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">{t('totals.remaining')}</CardTitle></CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums">{fmt(totals.remainingCents)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">{t('totals.late')}</CardTitle></CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums text-danger">{fmt(totals.lateCents)}</CardContent>
        </Card>
      </div>

      <ContractWorkflowSections
        data={{
          contractId: contract.id,
          state: contract.state,
          documents: workflow.value.docs.map((d) => ({
            id: d.id,
            name: d.name,
            required: d.required,
            status: d.status,
            note: d.note,
          })),
          boOwners: workflow.value.members.map((m) => ({ value: m.userId, label: m.name || m.email })),
          bo: {
            sentAt: contract.sentToBoAt?.toISOString() ?? null,
            receivedAt: contract.receivedByBoAt?.toISOString() ?? null,
          },
          decision: {
            reason: contract.decisionReason,
            nextAction: contract.nextAction,
            decidedAt: contract.decidedAt?.toISOString() ?? null,
          },
          risk: {
            checkedAt: contract.centralRiskCheckedAt?.toISOString() ?? null,
            result: contract.centralRiskResult,
          },
          bank: {
            name: contract.bankName,
            reference: contract.bankReference,
            notifiedAt: contract.bankNotifiedAt?.toISOString() ?? null,
          },
        }}
      />

      {deliveryRes.ok ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">
            {t('contract.delivery.title')}: {t(`contract.delivery.status.${deliveryRes.value.status}`)}
          </h2>
          {deliveryRes.value.deliveries.length === 0 ? (
            <p className="text-sm text-muted">{t('contract.delivery.none')}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {deliveryRes.value.deliveries.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2">
                  <Link href={`/${locale}/inventory/deliveries/${d.id}`} className="underline">{d.number}</Link>
                  <span className="text-muted">{tInv(`options.delivery_state.${d.state}`)}</span>
                  {d.deliveredAt ? <span className="text-muted">{d.deliveredAt.slice(0, 10)}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {debit && (debit.mandate || debit.canWrite) ? (
        <Panel
          title={t('mandate.title')}
          action={
            debit.mandate ? (
              <StatusChip tint={debit.mandate.active ? 'success' : 'neutral'}>
                {debit.mandate.active ? t('mandate.active') : t('mandate.inactive')}
              </StatusChip>
            ) : undefined
          }
        >
          <p className="text-sm text-muted">{t('mandate.hint')}</p>
          {debit.mandate ? (
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span dir="ltr">{maskCcpAccount(debit.mandate.ccpAccount)}</span>
              {debit.state.open > 0 ? <StatusChip tint="warning">{t('mandate.openDebits', { count: debit.state.open })}</StatusChip> : null}
              {debit.state.rejected > 0 ? <StatusChip tint="danger">{t('mandate.rejectedDebits', { count: debit.state.rejected })}</StatusChip> : null}
              {debit.state.lastRejectReason ? <span className="text-muted">{t('mandate.lastReason', { reason: debit.state.lastRejectReason })}</span> : null}
            </p>
          ) : (
            <p className="text-sm text-muted">{t('mandate.none')}</p>
          )}
          {debit.canWrite ? <MandateForm contractId={contract.id} mandate={debit.mandate} /> : null}
        </Panel>
      ) : null}

      <GuarantorsSection
        contractId={contract.id}
        state={contract.state}
        guarantors={workflow.value.guarantors.map((g) => ({
          id: g.id,
          fullName: g.fullName,
          nin: g.nin,
          phone: g.phone,
          address: g.address,
          relation: g.relation,
          hasIdDocument: g.hasIdDocument,
        }))}
      />

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">{t('contract.installments')}</h2>
        <InstallmentsTable
          rows={installments.map((i) => ({
            id: i.id,
            seq: i.seq,
            dueDate: i.dueDate,
            amountCents: i.amountCents,
            paidCents: i.paidCents,
            status: i.status,
          }))}
          locale={locale as 'fr' | 'ar' | 'en'}
          labels={{
            seq: t('contract.form.seq'),
            dueDate: t('contract.table.due_date'),
            amount: t('contract.table.amount'),
            paid: t('contract.table.paid'),
            statusHeader: t('contract.table.status'),
            status: statusLabels,
            empty: t('contract.form.previewEmpty'),
          }}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">{t('payment.title')}</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-muted">{t('payment.empty')}</p>
        ) : (
          <ul className="divide-y rounded-2xl border border-separator">
            {payments.map((p) => {
              const receipt = receiptByPayment.get(p.id);
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="tabular-nums" dir="ltr">{p.reference}</span>
                  <span>{t(`methods.${p.method}`)}</span>
                  <span className="tabular-nums">{fmt(p.amountCents)}</span>
                  {receipt ? (
                    <Link href={`/${locale}/credit/receipts/${receipt.id}/print`} className="underline">
                      {t('receipt.title')} {receipt.number}
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Chatter entity="credit_sales.contract" recordId={contract.id} />
    </section>
  );
}
