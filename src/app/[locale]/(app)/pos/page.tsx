import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { ErrorToast } from '@/ui/feedback/error-toast';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { withPageCtx } from '@/core/actions/page-ctx';
import { formatDzd } from '@/core/money';
import { routing } from '@/i18n/routing';
import { openSessionForm } from '@/modules/pos/actions';
import { listSessions } from '@/modules/pos/service/queries';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';

export default async function PosSessionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const query = await searchParams;
  const result = await withPageCtx((ctx) => listSessions(ctx));
  const t = await getTranslations('pos');
  const currentLocale = (await getLocale()) as 'fr' | 'ar' | 'en';

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('sessions.title')}</h1>

      <form action={openSessionForm} className="flex flex-col gap-2 rounded-md border p-4 sm:max-w-sm">
        <label className="flex flex-col gap-1 text-sm">
          {t('sessions.openingCash')}
          <Input name="openingCash" inputMode="decimal" required className="min-h-11" />
        </label>
        <Button type="submit" className="min-h-11">
          {t('sessions.open')}
        </Button>
        {query.error ? (
          <>
            <p role="alert" className="text-sm text-destructive">
              {t('errors.failed')}
            </p>
            <ErrorToast message={t('errors.failed')} />
          </>
        ) : null}
      </form>

      {result.ok ? (
        result.value.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('sessions.none')}</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-md border">
            {result.value.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/${locale}/pos/session/${s.id}`}
                  className="flex min-h-11 items-center justify-between gap-3 p-3 hover:bg-muted"
                >
                  <span className="text-sm">
                    {s.openedAt.toLocaleString(currentLocale === 'ar' ? 'ar-DZ' : `${currentLocale}-DZ`)}
                  </span>
                  <span className="text-sm tabular-nums">
                    {formatDzd(s.openingCashCents, currentLocale)}
                  </span>
                  <span className="text-sm">{t(`sessions.status.${s.state}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {t('errors.failed')}
        </p>
      )}
    </main>
  );
}
