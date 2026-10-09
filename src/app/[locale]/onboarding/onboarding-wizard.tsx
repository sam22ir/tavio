'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState, useTransition, type FormEvent } from 'react';
import { seedSampleDataAction } from '@/core/demo/actions';
import { BUSINESS_TYPES, type BusinessType } from '@/core/tenancy/business-types';
import { WILAYAS } from '@/core/tenancy/wilayas';
import { createCompanyStep, inviteTeamStep, saveBusinessTypeStep, type InviteRowResult } from './actions';

const ROLE_KEYS = ['admin', 'manager', 'staff'] as const;
type RoleKey = (typeof ROLE_KEYS)[number];
interface InviteRow {
  email: string;
  roleKey: RoleKey;
}

const PRIMARY = 'inline-flex items-center justify-center rounded-full bg-[#08409D] px-6 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';
const SECONDARY = 'inline-flex items-center justify-center rounded-full border border-[#08409D]/25 px-5 py-3 text-sm font-medium text-[#08409D] transition hover:bg-[#08409D]/5 disabled:cursor-not-allowed disabled:opacity-50';
const INPUT = 'w-full rounded-xl border border-[#0F172A]/15 bg-white px-4 py-3 text-sm text-[#0F172A] outline-none focus:border-[#08409D] focus:ring-2 focus:ring-[#08409D]/20 read-only:bg-[#F4F1EA]';

export function OnboardingWizard() {
  const t = useTranslations('onboarding');
  const locale = useLocale();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [legalName, setLegalName] = useState('');
  const [phone, setPhone] = useState('');
  const [wilayaCode, setWilayaCode] = useState('');
  const [logo, setLogo] = useState<File | null>(null);
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [rows, setRows] = useState<InviteRow[]>([{ email: '', roleKey: 'staff' }]);
  const [invites, setInvites] = useState<InviteRowResult[]>([]);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Synchronous guard: a second click before React re-renders must not start another request.
  const busy = useRef(false);

  function run(task: () => Promise<void>): void {
    if (busy.current) return;
    busy.current = true;
    setErrorKey(null);
    startTransition(async () => {
      try {
        await task();
      } finally {
        busy.current = false;
      }
    });
  }

  function submitBasics(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (companyId) {
      setStep(2);
      return;
    }
    run(async () => {
      const fd = new FormData();
      fd.set('legalName', legalName);
      fd.set('phone', phone);
      fd.set('wilayaCode', wilayaCode);
      if (logo) fd.set('logo', logo);
      const res = await createCompanyStep(fd);
      if (!res.ok) {
        setErrorKey(res.key);
        return;
      }
      setCompanyId(res.value.companyId);
      setStep(2);
    });
  }

  function saveType(): void {
    if (!companyId || !businessType) return;
    const id = companyId;
    const type = businessType;
    run(async () => {
      const res = await saveBusinessTypeStep({ companyId: id, businessType: type });
      if (!res.ok) {
        setErrorKey(res.key);
        return;
      }
      setStep(3);
    });
  }

  function sendInvites(): void {
    if (!companyId) return;
    const id = companyId;
    const filled = rows.filter((r) => r.email.trim());
    if (filled.length === 0) {
      setStep(4);
      return;
    }
    run(async () => {
      const res = await inviteTeamStep({ companyId: id, rows: filled });
      if (!res.ok) {
        setErrorKey(res.key);
        return;
      }
      setInvites(res.value);
      setStep(4);
    });
  }

  function chooseSample(): void {
    if (!companyId) return;
    const id = companyId;
    run(async () => {
      const res = await seedSampleDataAction(id);
      if (!res.ok) {
        setErrorKey('errors.sampleFailed');
        return;
      }
      router.replace(`/${locale}/dashboard`);
      router.refresh();
    });
  }

  function chooseEmpty(): void {
    run(async () => {
      router.replace(`/${locale}/dashboard`);
      router.refresh();
    });
  }

  function updateRow(index: number, patch: Partial<InviteRow>): void {
    setRows((current) => current.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  const back = (to: 1 | 2 | 3) => () => setStep(to);

  return (
    <div className="w-full max-w-xl rounded-[24px] bg-white p-6 text-start shadow-[0_8px_30px_rgba(8,64,157,0.06)] sm:p-10">
      <Image
        src="/brand/revora-logo.svg"
        alt={t('wizard.brandAlt')}
        width={160}
        height={40}
        priority
        className="mx-auto mb-8 h-10 w-auto"
      />

      <ol className="mb-8 flex items-center justify-center gap-2" aria-label={t('wizard.stepOf', { current: Math.min(step, 3), total: 3 })}>
        {[1, 2, 3].map((n) => (
          <li
            key={n}
            aria-current={n === step ? 'step' : undefined}
            className={`h-2 rounded-full transition-all ${n <= step ? 'w-8 bg-[#08409D]' : 'w-2 bg-[#08409D]/20'}`}
          />
        ))}
      </ol>

      {errorKey && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {t(errorKey)}
        </p>
      )}

      {step === 1 && (
        <form onSubmit={submitBasics} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold text-[#0F172A]">{t('basics.title')}</h1>
            <p className="text-sm text-[#0F172A]/65">{t('basics.subtitle')}</p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="legalName" className="text-sm font-medium text-[#0F172A]">
              {t('basics.legalName')}
            </label>
            <input
              id="legalName"
              name="legalName"
              type="text"
              required
              minLength={2}
              maxLength={200}
              value={legalName}
              readOnly={!!companyId}
              onChange={(e) => setLegalName(e.target.value)}
              className={INPUT}
            />
            <span className="text-xs text-[#0F172A]/55">{t('basics.legalNameHint')}</span>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="phone" className="text-sm font-medium text-[#0F172A]">
              {t('basics.phone')}
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              dir="ltr"
              maxLength={30}
              value={phone}
              readOnly={!!companyId}
              onChange={(e) => setPhone(e.target.value)}
              className={INPUT}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="wilayaCode" className="text-sm font-medium text-[#0F172A]">
              {t('basics.wilaya')}
            </label>
            <select
              id="wilayaCode"
              name="wilayaCode"
              value={wilayaCode}
              disabled={!!companyId}
              onChange={(e) => setWilayaCode(e.target.value)}
              className={INPUT}
            >
              <option value="">{t('basics.wilayaPlaceholder')}</option>
              {WILAYAS.map((w) => (
                <option key={w.code} value={w.code}>
                  {w.code} - {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="logo" className="text-sm font-medium text-[#0F172A]">
              {t('basics.logo')}
            </label>
            <input
              id="logo"
              name="logo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={!!companyId}
              onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
              className="text-sm text-[#0F172A]/75 file:me-4 file:rounded-full file:border-0 file:bg-[#08409D]/10 file:px-4 file:py-2 file:text-[#08409D]"
            />
            <span className="text-xs text-[#0F172A]/55">{t('basics.logoHint')}</span>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={pending} className={PRIMARY}>
              {pending ? t('wizard.pending') : t('wizard.next')}
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold text-[#0F172A]">{t('type.title')}</h1>
            <p className="text-sm text-[#0F172A]/65">{t('type.subtitle')}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {BUSINESS_TYPES.map((type) => {
              const selected = businessType === type;
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={selected}
                  disabled={pending}
                  onClick={() => setBusinessType(type)}
                  className={`flex flex-col gap-1 rounded-2xl border-2 p-4 text-start transition ${
                    selected ? 'border-[#08409D] bg-[#08409D]/5' : 'border-[#0F172A]/10 hover:border-[#08409D]/40'
                  }`}
                >
                  <span className="font-semibold text-[#0F172A]">{t(`type.${type}`)}</span>
                  <span className="text-xs text-[#0F172A]/60">{t(`type.${type}Hint`)}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button type="button" onClick={back(1)} disabled={pending} className={SECONDARY}>
              {t('wizard.back')}
            </button>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setStep(3)} disabled={pending} className={SECONDARY}>
                {t('wizard.skip')}
              </button>
              <button type="button" onClick={saveType} disabled={pending || !businessType} className={PRIMARY}>
                {pending ? t('wizard.pending') : t('wizard.continue')}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold text-[#0F172A]">{t('team.title')}</h1>
            <p className="text-sm text-[#0F172A]/65">{t('team.subtitle')}</p>
          </div>

          <div className="flex flex-col gap-3">
            {rows.map((row, index) => (
              <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_11rem_auto] sm:items-end">
                <div className="flex flex-col gap-1">
                  <label htmlFor={`invite-email-${index}`} className="text-xs font-medium text-[#0F172A]/70">
                    {t('team.email')}
                  </label>
                  <input
                    id={`invite-email-${index}`}
                    type="email"
                    dir="ltr"
                    value={row.email}
                    onChange={(e) => updateRow(index, { email: e.target.value })}
                    className={INPUT}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor={`invite-role-${index}`} className="text-xs font-medium text-[#0F172A]/70">
                    {t('team.role')}
                  </label>
                  <select
                    id={`invite-role-${index}`}
                    value={row.roleKey}
                    onChange={(e) => updateRow(index, { roleKey: e.target.value as RoleKey })}
                    className={INPUT}
                  >
                    {ROLE_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {t(`team.roles.${key}`)}
                      </option>
                    ))}
                  </select>
                </div>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                    className="px-2 py-3 text-sm text-[#08409D] hover:underline"
                  >
                    {t('team.removeRow')}
                  </button>
                )}
              </div>
            ))}
            <div>
              <button
                type="button"
                onClick={() => setRows((current) => [...current, { email: '', roleKey: 'staff' }])}
                disabled={rows.length >= 10}
                className="text-sm font-medium text-[#08409D] hover:underline disabled:opacity-50"
              >
                + {t('team.addRow')}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button type="button" onClick={back(2)} disabled={pending} className={SECONDARY}>
              {t('wizard.back')}
            </button>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setStep(4)} disabled={pending} className={SECONDARY}>
                {t('wizard.skip')}
              </button>
              <button type="button" onClick={sendInvites} disabled={pending} className={PRIMARY}>
                {pending ? t('wizard.pending') : t('wizard.sendInvites')}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold text-[#0F172A]">{t('done.title')}</h1>
            <p className="text-sm text-[#0F172A]/65">{t('done.subtitle')}</p>
          </div>

          {invites.length > 0 && (
            <div className="flex flex-col gap-2 rounded-2xl bg-[#F4F1EA] p-4 text-sm text-[#0F172A]/80">
              <p>{t('done.invitesSummary', { count: invites.length })}</p>
              <ul className="flex flex-col gap-2">
                {invites.map((r) => (
                  <li key={r.email} className="flex flex-col gap-1">
                    {r.status === 'sent' && <span>{t('team.sentEmail', { email: r.email })}</span>}
                    {r.status === 'failed' && <span className="text-red-800">{t('team.failed', { email: r.email })}</span>}
                    {r.status === 'link' && r.url && (
                      <>
                        <span>{t('team.createdLink', { email: r.email })}</span>
                        <code dir="ltr" className="break-all rounded-lg bg-white px-2 py-1 text-xs">
                          {r.url}
                        </code>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={chooseSample}
              disabled={pending}
              className="flex flex-col gap-2 rounded-2xl border-2 border-[#08409D] bg-[#08409D]/5 p-5 text-start transition hover:bg-[#08409D]/10 disabled:opacity-50"
            >
              <span className="font-semibold text-[#0F172A]">{t('done.sampleTitle')}</span>
              <span className="text-xs text-[#0F172A]/60">{t('done.sampleHint')}</span>
              <span className="mt-2 text-sm font-medium text-[#08409D]">{pending ? t('wizard.pending') : t('done.sampleCta')}</span>
            </button>
            <button
              type="button"
              onClick={chooseEmpty}
              disabled={pending}
              className="flex flex-col gap-2 rounded-2xl border-2 border-[#0F172A]/10 p-5 text-start transition hover:border-[#08409D]/40 disabled:opacity-50"
            >
              <span className="font-semibold text-[#0F172A]">{t('done.emptyTitle')}</span>
              <span className="text-xs text-[#0F172A]/60">{t('done.emptyHint')}</span>
              <span className="mt-2 text-sm font-medium text-[#08409D]">{t('done.emptyCta')}</span>
            </button>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl bg-[#F4F1EA]/70 p-4 text-sm">
            <span className="font-medium text-[#0F172A]">{t('done.helpTitle')}</span>
            <Link href={`/${locale}/contact`} className="w-fit font-medium text-[#08409D] hover:underline">
              {t('done.helpCta')}
            </Link>
          </div>

          <div className="flex justify-start">
            <button type="button" onClick={back(3)} disabled={pending} className={SECONDARY}>
              {t('wizard.back')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
