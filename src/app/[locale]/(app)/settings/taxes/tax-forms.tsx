'use client';

import { toast } from 'sonner';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  archiveTaxAction,
  createTaxAction,
  loadAlgerianDefaultsAction,
} from '@/modules/l10n_dz/actions';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';

type Status = { kind: 'ok' | 'error'; text: string } | null;

const SELECT_CLASS =
  'w-full text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50';

export function LoadDefaultsButton() {
  const t = useTranslations('l10n');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<Status>(null);

  function onClick() {
    start(async () => {
      const r = await loadAlgerianDefaultsAction({});
      if (!r.ok) {
        setStatus({ kind: 'error', text: t('taxes.error') }); toast.error(t('taxes.error'));
        return;
      }
      setStatus({
        kind: 'ok',
        text: r.value.inserted > 0 ? t('taxes.defaults_loaded', { count: r.value.inserted }) : t('taxes.defaults_none'),
      });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" onClick={onClick} disabled={pending}>
        {t('taxes.load_defaults')}
      </Button>
      <StatusLine status={status} />
    </div>
  );
}

export function TaxForm() {
  const t = useTranslations('l10n');
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<Status>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const str = (k: string) => String(fd.get(k) ?? '');
    const input = {
      code: str('code'),
      name: str('name'),
      kind: str('kind') as 'tva' | 'tap' | 'retenue_source' | 'other',
      rate: str('rate'),
      scope: str('scope') as 'sale' | 'purchase' | 'both',
      validFrom: str('validFrom'),
      validTo: str('validTo'),
      legalRef: str('legalRef'),
      isDefaultSale: fd.get('isDefaultSale') === 'on',
      isDefaultPurchase: fd.get('isDefaultPurchase') === 'on',
      active: true,
    };
    start(async () => {
      const r = await createTaxAction(input);
      if (!r.ok) {
        setStatus({ kind: 'error', text: r.error.code === 'CONFLICT' ? r.error.message : t('taxes.error') }); toast.error(r.error.code === 'CONFLICT' ? r.error.message : t('taxes.error'));
        return;
      }
      setStatus({ kind: 'ok', text: t('taxes.saved') });
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="tax-code">{t('fields.code')}</Label>
        <Input id="tax-code" name="code" required maxLength={20} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tax-name">{t('fields.name')}</Label>
        <Input id="tax-name" name="name" required maxLength={100} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tax-kind">{t('fields.kind')}</Label>
        <select id="tax-kind" name="kind" className={SELECT_CLASS} defaultValue="tva">
          <option value="tva">{t('options.kind.tva')}</option>
          <option value="tap">{t('options.kind.tap')}</option>
          <option value="retenue_source">{t('options.kind.retenue_source')}</option>
          <option value="other">{t('options.kind.other')}</option>
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tax-rate">{t('fields.rate')}</Label>
        <Input id="tax-rate" name="rate" inputMode="decimal" required placeholder="19" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tax-scope">{t('fields.scope')}</Label>
        <select id="tax-scope" name="scope" className={SELECT_CLASS} defaultValue="both">
          <option value="sale">{t('options.scope.sale')}</option>
          <option value="purchase">{t('options.scope.purchase')}</option>
          <option value="both">{t('options.scope.both')}</option>
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tax-legal">{t('fields.legalRef')}</Label>
        <Input id="tax-legal" name="legalRef" maxLength={500} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tax-from">{t('fields.validFrom')}</Label>
        <Input id="tax-from" name="validFrom" type="date" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tax-to">
          {t('fields.validTo')} <span className="text-muted">({t('taxes.valid_to_optional')})</span>
        </Label>
        <Input id="tax-to" name="validTo" type="date" />
      </div>
      <div className="flex flex-col gap-2 text-sm sm:col-span-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isDefaultSale" className="size-4" /> {t('fields.isDefaultSale')}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isDefaultPurchase" className="size-4" /> {t('fields.isDefaultPurchase')}
        </label>
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {t('taxes.save')}
        </Button>
        <StatusLine status={status} />
      </div>
    </form>
  );
}

export function ArchiveTaxButton({ id }: { id: string }) {
  const t = useTranslations('l10n');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<Status>(null);

  function onClick() {
    start(async () => {
      const r = await archiveTaxAction({ id });
      if (!r.ok) {
        setStatus({ kind: 'error', text: t('taxes.error') }); toast.error(t('taxes.error'));
        return;
      }
      setStatus({ kind: 'ok', text: t('taxes.archived') });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="ghost" size="sm" onClick={onClick} disabled={pending}>
        {t('taxes.archive')}
      </Button>
      <StatusLine status={status} />
    </div>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <p role="status" className={status.kind === 'ok' ? 'text-sm text-tint-success-fg' : 'text-sm text-danger'}>
      {status.text}
    </p>
  );
}
