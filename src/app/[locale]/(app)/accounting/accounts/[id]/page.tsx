import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { getAccountById, type AccountType } from '@/modules/accounting/service/chart';
import { AccountForm } from '@/modules/accounting/ui/account-form';

export default async function AccountEditPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const account = await withPageCtx((ctx) => getAccountById(ctx, id));
  if (!account) notFound();
  const t = await getTranslations('accounting');
  const currentLocale = await getLocale();

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="font-mono text-xl font-semibold">{`${account.code} · ${account.name}`}</h1>
      {account.archived ? <p className="text-sm">{t('accounts.archived')}</p> : null}
      <AccountForm
        locale={currentLocale}
        account={{ id: account.id, code: account.code, name: account.name, type: account.type as AccountType, reconcilable: account.reconcilable, archived: account.archived }}
      />
    </div>
  );
}
