import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { withPageCtx } from '@/core/actions/page-ctx';
import { formatDzd } from '@/core/money';
import { routing } from '@/i18n/routing';
import { getSession, sellableProducts } from '@/modules/pos/service/queries';
import { sessionReport } from '@/modules/pos/service/sessions';
import { PosScreen } from '@/modules/pos/ui/pos-screen';
import { companyIdentityOf } from '@/modules/invoicing/queries';
import { buttonVariants } from '@/ui/primitives/button';
import { cn } from '@/ui/lib/cn';

export default async function PosSessionPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('pos');
  const currentLocale = (await getLocale()) as 'fr' | 'ar' | 'en';

  const data = await withPageCtx(async (ctx) => {
    const session = await getSession(ctx, id);
    if (!session.ok) return null;
    if (session.value.state === 'open') {
      const [products, company] = await Promise.all([sellableProducts(ctx), companyIdentityOf(ctx)]);
      return { open: true as const, products: products.ok ? products.value : [], company };
    }
    const report = await sessionReport(ctx, id);
    return { open: false as const, report: report.ok ? report.value : null };
  });

  if (!data) notFound();

  if (data.open) {
    if (!data.company) notFound();
    return (
      <main className="min-h-dvh">
        <PosScreen
          sessionId={id}
          company={data.company}
          products={data.products.map((p) => ({
            id: p.id,
            name: p.name,
            priceCents: p.priceCents.toString(),
            taxRate: p.taxRate,
          }))}
        />
      </main>
    );
  }

  const r = data.report;
  const money = (c: bigint | null): string => (c === null ? '-' : formatDzd(c, currentLocale));

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <Link href={`/${locale}/pos`} className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11 w-fit')}>
        {t('session.back')}
      </Link>
      <h1 className="text-xl font-semibold">{t('session.closed')}</h1>
      {r ? (
        <dl className="grid max-w-md grid-cols-2 gap-2 text-sm">
          <dt>{t('session.openingCash')}</dt>
          <dd className="tabular-nums">{money(r.openingCashCents)}</dd>
          <dt>{t('session.cashSales')}</dt>
          <dd className="tabular-nums">{money(r.cashSalesCents)}</dd>
          <dt>{t('session.cardSales')}</dt>
          <dd className="tabular-nums">{money(r.cardSalesCents)}</dd>
          <dt>{t('session.orders')}</dt>
          <dd>{r.orderCount}</dd>
          <dt>{t('session.expectedCash')}</dt>
          <dd className="tabular-nums">{money(r.expectedCashCents)}</dd>
          <dt>{t('session.closingCash')}</dt>
          <dd className="tabular-nums">{money(r.closingCashCents)}</dd>
          <dt>{t('session.difference')}</dt>
          <dd className="tabular-nums">{money(r.differenceCents)}</dd>
        </dl>
      ) : null}
    </main>
  );
}
