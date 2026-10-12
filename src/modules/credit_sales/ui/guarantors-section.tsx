'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import { addGuarantorForm, removeGuarantorById, updateGuarantorForm } from '../actions/guarantors';

export interface GuarantorView {
  id: string;
  fullName: string;
  nin: string;
  phone: string | null;
  address: string | null;
  relation: string | null;
  hasIdDocument: boolean;
}

const ID_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
const EDITABLE_STATES = ['draft', 'approved'] as const;

function GuarantorFields({ defaults, idPrefix }: { defaults?: GuarantorView; idPrefix: string }) {
  const t = useTranslations('credit.guarantors');
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-fullName`}>{t('fullName')}</Label>
        <Input id={`${idPrefix}-fullName`} name="fullName" required maxLength={120} defaultValue={defaults?.fullName ?? ''} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-nin`}>{t('nin')}</Label>
        <Input id={`${idPrefix}-nin`} name="nin" required minLength={3} maxLength={40} dir="ltr" defaultValue={defaults?.nin ?? ''} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-phone`}>{t('phone')}</Label>
        <Input id={`${idPrefix}-phone`} name="phone" type="tel" maxLength={30} dir="ltr" defaultValue={defaults?.phone ?? ''} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-relation`}>{t('relation')}</Label>
        <Input id={`${idPrefix}-relation`} name="relation" maxLength={60} defaultValue={defaults?.relation ?? ''} />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-address`}>{t('address')}</Label>
        <Input id={`${idPrefix}-address`} name="address" maxLength={300} defaultValue={defaults?.address ?? ''} />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-idDocument`}>{t('idDocument')}</Label>
        <input id={`${idPrefix}-idDocument`} name="idDocument" type="file" accept={ID_ACCEPT}
          className="block text-sm file:me-3 file:rounded-md file:border file:px-3 file:py-2" />
        {defaults?.hasIdDocument ? <span className="text-xs text-muted">{t('idDocumentAttached')}</span> : null}
      </div>
    </div>
  );
}

/** Guarantors on a contract. Editable while the contract is draft or approved. */
export function GuarantorsSection({ contractId, state, guarantors }: {
  contractId: string;
  state: string;
  guarantors: GuarantorView[];
}) {
  const t = useTranslations('credit.guarantors');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editable = (EDITABLE_STATES as readonly string[]).includes(state);

  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, done: string, after?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error?.message ?? done);
        return;
      }
      toast.success(done);
      after?.();
      router.refresh();
    });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">{t('title')}</h2>
        {editable && !adding ? (
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setAdding(true)}>{t('add')}</Button>
        ) : null}
      </div>
      {!editable ? <p className="text-sm text-muted">{t('locked')}</p> : null}

      {guarantors.length === 0 && !adding ? <p className="text-sm text-muted">{t('empty')}</p> : null}

      <ul className="flex flex-col gap-3">
        {guarantors.map((g) => (
          <li key={g.id} className="rounded-2xl bg-surface-secondary p-3 text-sm">
            {editingId === g.id ? (
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  run(() => updateGuarantorForm(g.id, formData), t('saved'), () => setEditingId(null));
                }}
              >
                <GuarantorFields defaults={g} idPrefix={`edit-${g.id}`} />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={pending} className="min-h-11">{t('save')}</Button>
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => setEditingId(null)}>{t('cancel')}</Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{g.fullName}</span>
                  <span className="text-muted" dir="ltr">{t('nin')}: {g.nin}</span>
                  {g.relation ? <span className="text-muted">{g.relation}</span> : null}
                  {g.phone ? <span className="text-muted" dir="ltr">{g.phone}</span> : null}
                  {g.address ? <span className="text-muted">{g.address}</span> : null}
                  {g.hasIdDocument ? <span className="text-muted">{t('idDocumentAttached')}</span> : null}
                </div>
                {editable ? (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={() => setEditingId(g.id)}>
                      {t('edit')}
                    </Button>
                    <Button type="button" variant="outline" className="min-h-11" disabled={pending}
                      onClick={() => run(() => removeGuarantorById(g.id), t('removed'))}>
                      {t('remove')}
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </li>
        ))}
      </ul>

      {adding ? (
        <form
          className="flex flex-col gap-3 rounded-2xl bg-surface-secondary p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            run(() => addGuarantorForm(contractId, formData), t('saved'), () => setAdding(false));
          }}
        >
          <GuarantorFields idPrefix="new-guarantor" />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending} className="min-h-11">{t('save')}</Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setAdding(false)}>{t('cancel')}</Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
