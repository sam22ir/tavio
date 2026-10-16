import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { DEFAULT_CLAUSES_AR, DEFAULT_CLAUSES_FR } from '@/modules/credit_sales/service/clause-defaults';
import { CLAUSE_VARIABLES, getContractSettings } from '@/modules/credit_sales/service/clauses';
import { ClauseSettingsForm } from '@/modules/credit_sales/ui/clause-settings-form';

export default async function ContractClausesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('credit');

  const res = await withPageCtx((ctx) => getContractSettings(ctx));
  if (!res.ok) notFound();
  const s = res.value;
  const cents = s.guarantorRequiredAboveCents;
  const threshold = cents === null
    ? ''
    : `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, '0')}`;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('clauses.title')}</h1>
        <p className="text-sm text-muted">{t('clauses.intro')}</p>
      </div>
      <ClauseSettingsForm
        initial={{
          clausesFr: s.clausesFr ?? '',
          clausesAr: s.clausesAr ?? '',
          city: s.city ?? '',
          latePenaltyRate: s.latePenaltyRate ?? '',
          guarantorRequiredAboveDzd: threshold,
        }}
        defaults={{ fr: DEFAULT_CLAUSES_FR, ar: DEFAULT_CLAUSES_AR }}
        variables={CLAUSE_VARIABLES}
      />
    </section>
  );
}
