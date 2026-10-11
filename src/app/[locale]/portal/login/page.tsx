import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { requestPortalLoginAction } from '@/core/portal/login-action';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PortalLoginPage({
  params, searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ c?: string; sent?: string; e?: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { c, sent, e } = await searchParams;
  const t = await getTranslations('portal');
  const companyId = c && UUID_RE.test(c) ? c : null;

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{t('login.title')}</h1>
        <p className="mt-1 text-sm text-stone-600">{t('login.intro')}</p>
      </div>

      {e ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {t(`login.errors.${['expired', 'used', 'link', 'config', 'invalid'].includes(e) ? e : 'link'}`)}
        </p>
      ) : null}

      {sent ? (
        <p role="status" className="rounded-lg border border-stone-200 bg-white p-4 text-sm">{t('login.sent')}</p>
      ) : !companyId ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {t('login.errors.company_missing')}
        </p>
      ) : (
        <form action={requestPortalLoginAction} className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="c" value={companyId} />
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t('login.identifier')}
            <input
              name="identifier"
              type="text"
              required
              minLength={3}
              autoComplete="username"
              inputMode="email"
              placeholder={t('login.placeholder')}
              className="min-h-11 rounded-lg border border-stone-300 bg-white px-3 text-base outline-none focus:border-[oklch(0.55_0.11_185)]"
            />
          </label>
          <button type="submit" className="min-h-11 rounded-lg bg-[oklch(0.55_0.11_185)] px-4 font-medium text-white">
            {t('login.submit')}
          </button>
        </form>
      )}
    </section>
  );
}
