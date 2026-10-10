'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import {
  acknowledgeBoAction,
  decideContractById,
  notifyBankAction,
  recordCentralRiskAction,
  sendToBoAction,
  setDocumentStatusAction,
} from '../actions/workflow';

export interface ContractDocumentView {
  id: string;
  name: string;
  required: boolean;
  status: string;
  note: string | null;
}

export interface ContractWorkflowData {
  contractId: string;
  state: string;
  documents: ContractDocumentView[];
  bo: { sentAt: string | null; receivedAt: string | null };
  boOwners: { value: string; label: string }[];
  decision: { reason: string | null; nextAction: string | null; decidedAt: string | null };
  risk: { checkedAt: string | null; result: string | null };
  bank: { name: string | null; reference: string | null; notifiedAt: string | null };
}

const SECTION = 'rounded-md border p-4 space-y-3';

/** Document checklist, back office, decision, central risk and bank sections for one contract. */
export function ContractWorkflowSections({ data }: { data: ContractWorkflowData }) {
  const t = useTranslations('credit.workflow');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [boOwner, setBoOwner] = useState(data.boOwners[0]?.value ?? '');
  const [reason, setReason] = useState(data.decision.reason ?? '');
  const [nextAction, setNextAction] = useState(data.decision.nextAction ?? '');
  const [bankName, setBankName] = useState(data.bank.name ?? '');
  const [bankReference, setBankReference] = useState(data.bank.reference ?? '');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const editable = data.state === 'submitted' || data.state === 'under_review';

  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error?.message ?? t('done'));
        return;
      }
      toast.success(t('done'));
      router.refresh();
    });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className={SECTION}>
        <h3 className="font-medium">{t('documents.title')}</h3>
        {data.documents.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('documents.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {data.documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  {doc.name}{' '}
                  <span className="text-muted-foreground">
                    ({doc.required ? t('documents.required') : t('documents.optional')})
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span>{t(`documents.${doc.status}`)}</span>
                  {editable ? (
                    <>
                      <Button type="button" variant="outline" size="sm" disabled={pending}
                        onClick={() => run(() => setDocumentStatusAction({ id: doc.id, status: 'received' }))}>
                        {t('documents.markReceived')}
                      </Button>
                      <Button type="button" variant="outline" size="sm" disabled={pending}
                        onClick={() => run(() => setDocumentStatusAction({ id: doc.id, status: 'rejected' }))}>
                        {t('documents.markRejected')}
                      </Button>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={SECTION}>
        <h3 className="font-medium">{t('bo.title')}</h3>
        {data.bo.sentAt ? (
          <p className="text-sm">{t('bo.sentAt')}: {new Date(data.bo.sentAt).toLocaleString()}</p>
        ) : editable ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="grow">
              <Label htmlFor="bo-owner">{t('bo.owner')}</Label>
              <select id="bo-owner" className="block w-full rounded-md border bg-background p-2 text-sm"
                value={boOwner} onChange={(e) => setBoOwner(e.target.value)}>
                {data.boOwners.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <Button type="button" disabled={pending || !boOwner}
              onClick={() => run(() => sendToBoAction(data.contractId, boOwner))}>
              {t('bo.send')}
            </Button>
          </div>
        ) : null}
        {data.bo.sentAt && !data.bo.receivedAt ? (
          <Button type="button" variant="outline" disabled={pending}
            onClick={() => run(() => acknowledgeBoAction(data.contractId))}>
            {t('bo.acknowledge')}
          </Button>
        ) : null}
        {data.bo.receivedAt ? (
          <p className="text-sm">{t('bo.receivedAt')}: {new Date(data.bo.receivedAt).toLocaleString()}</p>
        ) : null}
      </section>

      <section className={SECTION}>
        <h3 className="font-medium">{t('decision.title')}</h3>
        <div className="space-y-2">
          <Label htmlFor="decision-reason">{t('decision.reason')}</Label>
          <Input id="decision-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Label htmlFor="decision-next">{t('decision.nextAction')}</Label>
          <Input id="decision-next" value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
          {reasonError ? <p className="text-destructive text-sm">{reasonError}</p> : null}
        </div>
        {data.state === 'under_review' ? (
          <div className="flex gap-2">
            <Button type="button" disabled={pending}
              onClick={() => run(() => decideContractById({ id: data.contractId, decision: 'approved', nextAction }))}>
              {t('decision.approve')}
            </Button>
            <Button type="button" variant="outline" disabled={pending}
              onClick={() => {
                if (!reason.trim()) {
                  setReasonError(t('decision.reasonRequired'));
                  return;
                }
                setReasonError(null);
                run(() => decideContractById({ id: data.contractId, decision: 'refused', reason, nextAction }));
              }}>
              {t('decision.refuse')}
            </Button>
          </div>
        ) : null}
        {data.decision.decidedAt ? (
          <p className="text-muted-foreground text-sm">{t('decision.decidedAt')}: {new Date(data.decision.decidedAt).toLocaleString()}</p>
        ) : null}
      </section>

      <section className={SECTION}>
        <h3 className="font-medium">{t('risk.title')}</h3>
        {data.state === 'under_review' ? (
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={pending}
              onClick={() => run(() => recordCentralRiskAction(data.contractId, 'clear'))}>
              {t('risk.clear')}
            </Button>
            <Button type="button" variant="outline" disabled={pending}
              onClick={() => run(() => recordCentralRiskAction(data.contractId, 'flagged'))}>
              {t('risk.flagged')}
            </Button>
          </div>
        ) : null}
        {data.risk.checkedAt ? (
          <p className="text-sm">
            {t('risk.checkedAt')}: {new Date(data.risk.checkedAt).toLocaleString()} ({t(`risk.${data.risk.result}`)})
          </p>
        ) : null}
      </section>

      <section className={SECTION}>
        <h3 className="font-medium">{t('bank.title')}</h3>
        {data.bank.notifiedAt ? (
          <p className="text-sm">
            {t('bank.notifiedAt')}: {new Date(data.bank.notifiedAt).toLocaleString()} ({data.bank.name})
          </p>
        ) : data.state === 'approved' || data.state === 'reserved' ? (
          <div className="space-y-2">
            <Label htmlFor="bank-name">{t('bank.name')}</Label>
            <Input id="bank-name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            <Label htmlFor="bank-ref">{t('bank.reference')}</Label>
            <Input id="bank-ref" value={bankReference} onChange={(e) => setBankReference(e.target.value)} />
            <Button type="button" disabled={pending}
              onClick={() => run(() => notifyBankAction({ id: data.contractId, bankName, bankReference }))}>
              {t('bank.notify')}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
