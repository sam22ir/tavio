import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { cancelDeliveryForm, validateDeliveryForm } from '@/modules/inventory/actions';
import { listDeliveries, partnerDisplayNames, SIGNED_BY_REQUIRED } from '@/modules/inventory/service/deliveries';
import { ErrorToast } from '@/ui/feedback/error-toast';
import { Button } from '@/ui/primitives/button';

export default async function DeliveriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; f_sourceId?: string; f_partnerId?: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('inventory');
  const tViews = await getTranslations('views');
  const { error: failure, f_sourceId, f_partnerId } = await searchParams;
  const result = await withPageCtx((ctx) => listDeliveries(ctx, { sourceId: f_sourceId, partnerId: f_partnerId }));
  const names = result.ok
    ? await withPageCtx((ctx) => partnerDisplayNames(ctx, result.value.map((row) => row.partnerId)))
    : null;
  const partnerNames = names?.ok ? names.value : new Map<string, string>();

  const failureMessage =
    failure === SIGNED_BY_REQUIRED ? t(`errors.${SIGNED_BY_REQUIRED}`) : failure ? tViews('error') : null;

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      {failureMessage ? <ErrorToast message={failureMessage} /> : null}
      <h1 className="text-xl font-semibold">{t('deliveries.title')}</h1>
      {result.ok ? (
        result.value.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('common.empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-start font-medium">{t('fields.number')}</th>
                  <th className="p-3 text-start font-medium">{t('fields.partner')}</th>
                  <th className="p-3 text-end font-medium">{t('fields.lines')}</th>
                  <th className="p-3 text-start font-medium">{t('fields.scheduled_date')}</th>
                  <th className="p-3 text-start font-medium">{t('fields.delivered_at')}</th>
                  <th className="p-3 text-start font-medium">{t('fields.state')}</th>
                  <th className="p-3 text-start font-medium" />
                </tr>
              </thead>
              <tbody>
                {result.value.map((row) => {
                  const open = row.state === 'draft' || row.state === 'ready';
                  return (
                    <tr key={row.id} className="border-t">
                      <td className="p-3"><Link href={`/${locale}/inventory/deliveries/${row.id}`} className="underline">{row.number}</Link></td>
                      <td className="p-3 break-words">{partnerNames.get(row.partnerId) ?? '–'}</td>
                      <td className="p-3 text-end tabular-nums">{row.lineCount}</td>
                      <td className="p-3">{row.scheduledDate ?? '–'}</td>
                      <td className="p-3">{row.deliveredAt ? row.deliveredAt.slice(0, 10) : '–'}</td>
                      <td className="p-3">{t(`options.delivery_state.${row.state}`)}</td>
                      <td className="p-3">
                        {open ? (
                          <div className="flex flex-wrap gap-2">
                            <Link href={`/${locale}/inventory/deliveries/${row.id}`} className="inline-flex h-8 items-center px-3 text-sm underline">
                              {t('deliveries.open')}
                            </Link>
                            <form action={validateDeliveryForm}>
                              <input type="hidden" name="id" value={row.id} />
                              <Button type="submit" variant="outline" size="sm">
                                {t('deliveries.validate')}
                              </Button>
                            </form>
                            <form action={cancelDeliveryForm}>
                              <input type="hidden" name="id" value={row.id} />
                              <Button type="submit" variant="ghost" size="sm">
                                {t('deliveries.cancel')}
                              </Button>
                            </form>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {t('common.error')}
        </p>
      )}
    </main>
  );
}
