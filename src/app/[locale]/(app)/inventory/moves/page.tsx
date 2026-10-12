import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { validateMoveForm } from '@/modules/inventory/actions';
import { listMoves } from '@/modules/inventory/service/moves';
import { Button, buttonVariants } from '@/ui/primitives/button';
import { cn } from '@/ui/lib/cn';

export default async function MovesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ f_productId?: string; f_sourceId?: string }>;
}) {
  const { locale } = await params;
  const { f_productId, f_sourceId } = await searchParams;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('inventory');
  const currentLocale = await getLocale();
  const result = await withPageCtx((ctx) =>
    listMoves(ctx, { productId: f_productId, sourceId: f_sourceId }),
  );

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">{t('moves.title')}</h1>
        <Link href={`/${currentLocale}/inventory/moves/new`} className={cn(buttonVariants())}>
          {t('moves.new')}
        </Link>
      </header>
      {result.ok ? (
        result.value.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('common.empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-default/50">
                <tr>
                  <th className="p-3 text-start font-medium">{t('fields.reference')}</th>
                  <th className="p-3 text-start font-medium">{t('fields.product')}</th>
                  <th className="p-3 text-end font-medium">{t('fields.quantity')}</th>
                  <th className="p-3 text-start font-medium">{t('fields.from')} → {t('fields.to')}</th>
                  <th className="p-3 text-start font-medium">{t('fields.state')}</th>
                  <th className="p-3 text-start font-medium" />
                </tr>
              </thead>
              <tbody>
                {result.value.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-3">
                      <Link href={`/${currentLocale}/inventory/moves/${row.id}`} className="hover:underline">
                        {row.reference}
                      </Link>
                    </td>
                    <td className="p-3 break-words">{row.productName}</td>
                    <td className="p-3 text-end tabular-nums">{row.quantity}</td>
                    <td className="p-3 break-words">
                      {row.fromLocationName} → {row.toLocationName}
                    </td>
                    <td className="p-3">{t(`options.state.${row.state}`)}</td>
                    <td className="p-3">
                      {row.state === 'draft' ? (
                        <form action={validateMoveForm}>
                          <input type="hidden" name="id" value={row.id} />
                          <Button type="submit" variant="outline" size="sm">
                            {t('moves.validate')}
                          </Button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {t('common.error')}
        </p>
      )}
    </div>
  );
}
