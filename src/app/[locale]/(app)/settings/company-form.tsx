'use client';

import { inputVariants } from '@heroui/styles';
import { cn } from '@/ui/lib/cn';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { WILAYAS } from '@/core/tenancy/wilayas';
import { updateCompanyIdentity, type CompanyFormState } from './actions';

export interface CompanyFormValues {
  legalName: string;
  displayName: string;
  address: string;
  wilayaCode: string;
  phone: string;
  email: string;
  nif: string;
  nis: string;
  rc: string;
  ai: string;
  rib: string;
  ccp: string;
  logoUrl: string | null;
}

const inputCls = cn(inputVariants({ variant: 'primary' }), 'min-h-11 w-full rounded-full px-4 text-sm');

export function CompanyForm({ values }: { values: CompanyFormValues }) {
  const t = useTranslations('settings.company');
  const [state, action, pending] = useActionState<CompanyFormState, FormData>(updateCompanyIdentity, { status: 'idle' });

  const field = (name: keyof Omit<CompanyFormValues, 'logoUrl' | 'wilayaCode'>, required = false) => (
    <label key={name} className="flex flex-col gap-1 text-sm">
      {t(`fields.${name}`)}
      <input name={name} defaultValue={values[name]} required={required} maxLength={255} className={inputCls} />
    </label>
  );

  return (
        <section className="app-panel flex flex-col gap-4 p-5">
    <form action={action} className="flex flex-col gap-6">
      {state.status === 'error' ? (
        <p role="alert" className="text-sm text-danger">{t(state.key.replace(/^errors\./, 'errors.'))}</p>
      ) : null}
      {state.status === 'saved' ? (
        <div className="flex flex-col gap-2 text-sm">
          <p role="status">{t('saved')}</p>
          {state.warnings.length > 0 ? (
            <ul className="list-disc ps-5 text-tint-warning-fg">
              {state.warnings.map((w) => (
                <li key={w}>{t(`warnings.${w}`)}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {field('legalName', true)}
        {field('displayName', true)}
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          {t('fields.address')}
          <input name="address" defaultValue={values.address} maxLength={255} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('fields.wilayaCode')}
          <select name="wilayaCode" defaultValue={values.wilayaCode} className="min-h-11 w-full text-sm">
            <option value="">—</option>
            {WILAYAS.map((w) => (
              <option key={w.code} value={w.code}>
                {w.code} · {w.name}
              </option>
            ))}
          </select>
        </label>
        {field('phone')}
        {field('email')}
        {field('nif')}
        {field('nis')}
        {field('rc')}
        {field('ai')}
        {field('rib')}
        {field('ccp')}
      </div>
      <p className="text-xs text-muted">{t('verifyNote')}</p>

      <div className="flex flex-col gap-2 text-sm">
        <span>{t('fields.logo')}</span>
        {values.logoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={values.logoUrl} alt="" className="max-h-16 w-auto" />
          </>
        ) : (
          <p className="text-muted">{t('noLogo')}</p>
        )}
        <input type="file" name="logo" accept="image/jpeg,image/png,image/webp,application/pdf" className="text-sm" />
      </div>

      <button type="submit" disabled={pending} className="min-h-11 w-fit rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {t('save')}
      </button>
    </form>
    </section>
  );
}
