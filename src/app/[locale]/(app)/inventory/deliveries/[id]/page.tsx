import Link from 'next/link';
import { ErrorToast } from '@/ui/feedback/error-toast';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import {
  saveDeliverySignedByForm,
  uploadDeliveryFileForm,
  validateDeliveryForm,
} from '@/modules/inventory/actions';
import {
  CONTRACT_SOURCE_ENTITY,
  deliveryFileUrl,
  getDelivery,
  partnerDisplayNames,
  SIGNED_BY_REQUIRED,
} from '@/modules/inventory/service/deliveries';
import { remainingOf, toMilliText } from '@/modules/inventory/service/delivery-view';
import { Button } from '@/ui/primitives/button';
import {
  DELIVERY_NOTHING_DELIVERED,
  DELIVERY_QTY_INVALID,
  DELIVERY_QTY_OVER,
} from '@/modules/inventory/service/delivery-plan';

export default async function DeliveryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('inventory');
  const tViews = await getTranslations('views');
  const { error: failure } = await searchParams;
  const currentLocale = await getLocale();
  const result = await withPageCtx((ctx) => getDelivery(ctx, id));
  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return (
      <div className="p-4 md:p-6">
        <p role="alert" className="text-sm text-destructive">{t('common.error')}</p>
      </div>
    );
  }
  const delivery = result.value;
  const open = delivery.state === 'draft' || delivery.state === 'ready';
  const partnerNames = await withPageCtx((ctx) => partnerDisplayNames(ctx, [delivery.partnerId]));
  const partnerName = partnerNames.ok ? partnerNames.value.get(delivery.partnerId) ?? '–' : '–';
  const knownFailures: readonly string[] = [SIGNED_BY_REQUIRED, DELIVERY_QTY_INVALID, DELIVERY_QTY_OVER, DELIVERY_NOTHING_DELIVERED];
  const failureMessage = failure && knownFailures.includes(failure) ? t(`errors.${failure}`) : failure ? tViews('error') : null;
  const signatureUrl = delivery.signatureFileId
    ? await withPageCtx((ctx) => deliveryFileUrl(ctx, delivery.signatureFileId as string))
    : null;
  const proofUrl = delivery.proofFileId
    ? await withPageCtx((ctx) => deliveryFileUrl(ctx, delivery.proofFileId as string))
    : null;
  const contractHref =
    delivery.sourceEntity === CONTRACT_SOURCE_ENTITY && delivery.sourceId
      ? `/${currentLocale}/credit/contracts/${delivery.sourceId}`
      : null;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {failureMessage ? <ErrorToast message={failureMessage} /> : null}
      <Link href={`/${currentLocale}/inventory/deliveries`} className="text-sm text-muted-foreground hover:underline">
        ← {t('deliveries.title')}
      </Link>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold break-words">{delivery.number}</h1>
          <span className="text-sm text-muted-foreground">{t(`options.delivery_state.${delivery.state}`)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${currentLocale}/inventory/deliveries/${delivery.id}/print`}
            className="inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium"
          >
            {t('deliveries.print')}
          </Link>
        </div>
      </header>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-md border p-4 sm:grid-cols-2">
        <Item label={t('fields.partner')} value={partnerName} />
        <Item label={t('fields.scheduled_date')} value={delivery.scheduledDate ?? '–'} />
        <Item label={t('fields.delivered_at')} value={delivery.deliveredAt ? delivery.deliveredAt.slice(0, 10) : '–'} />
        {delivery.originDeliveryId ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{t('deliveries.backorder_of')}</dt>
            <dd className="text-sm">
              <Link href={`/${currentLocale}/inventory/deliveries/${delivery.originDeliveryId}`} className="underline">
                {delivery.originNumber ?? '–'}
              </Link>
            </dd>
          </div>
        ) : null}
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">{t('deliveries.source_contract')}</dt>
          <dd className="text-sm">
            {contractHref ? (
              <Link href={contractHref} className="underline">{t('deliveries.view_contract')}</Link>
            ) : (
              '–'
            )}
          </dd>
        </div>
      </dl>

      <form action={validateDeliveryForm} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={delivery.id} />
        <input type="hidden" name="returnTo" value="detail" />
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">{t('deliveries.lines_title')}</h2>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-default/50">
                <tr>
                  <th className="p-3 text-start font-medium">{t('fields.product')}</th>
                  <th className="p-3 text-end font-medium">{t('deliveries.ordered')}</th>
                  <th className="p-3 text-end font-medium">{t('deliveries.delivered_qty')}</th>
                  <th className="p-3 text-end font-medium">{t('deliveries.remaining')}</th>
                </tr>
              </thead>
              <tbody>
                {delivery.lines.map((line) => (
                  <tr key={line.id} className="border-t">
                    <td className="p-3 break-words">{line.productName}</td>
                    <td className="p-3 text-end tabular-nums">{toMilliText(line.quantity)}</td>
                    <td className="p-3 text-end tabular-nums">
                      {open ? (
                        <label className="flex flex-col items-end gap-1">
                          <span className="sr-only">{t('deliveries.edit_qty')}</span>
                          <input
                            name={`qty_${line.id}`}
                            inputMode="decimal"
                            defaultValue={remainingOf(line.quantity, line.deliveredQty)}
                            className="min-h-11 w-28 rounded-md border p-2 text-end"
                          />
                        </label>
                      ) : (
                        toMilliText(line.deliveredQty)
                      )}
                    </td>
                    <td className="p-3 text-end tabular-nums">{remainingOf(line.quantity, line.deliveredQty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {open ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" name="noBackorder" className="size-5" />
                <span>{t('deliveries.no_backorder')}</span>
              </label>
              <Button type="submit">{t('deliveries.validate')}</Button>
            </div>
          ) : null}
          {open ? <p className="text-xs text-muted-foreground">{t('deliveries.backorder_hint')}</p> : null}
        </section>
      </form>

      <section className="flex flex-col gap-3 rounded-md border p-4">
        <h2 className="text-base font-semibold">{t('deliveries.receipt_title')}</h2>
        <form action={saveDeliverySignedByForm} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="id" value={delivery.id} />
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span>{t('deliveries.signed_by')}</span>
            <input
              name="signedByName"
              defaultValue={delivery.signedByName ?? ''}
              maxLength={200}
              disabled={!open}
              required
              className="rounded-md border p-2"
            />
          </label>
          {open ? (
            <Button type="submit" variant="outline">{t('deliveries.save')}</Button>
          ) : null}
        </form>
        {!delivery.signedByName ? <p className="text-xs text-muted-foreground">{t('deliveries.signed_by_hint')}</p> : null}

        <FileSlot
          label={t('deliveries.signature')}
          uploadedLabel={t('deliveries.uploaded')}
          missingLabel={t('deliveries.not_uploaded')}
          viewLabel={t('deliveries.view_file')}
          uploadLabel={t('deliveries.upload')}
          deliveryId={delivery.id}
          kind="signature"
          url={signatureUrl && signatureUrl.ok ? signatureUrl.value : null}
          hasFile={Boolean(delivery.signatureFileId)}
          open={open}
        />
        <FileSlot
          label={t('deliveries.proof')}
          uploadedLabel={t('deliveries.uploaded')}
          missingLabel={t('deliveries.not_uploaded')}
          viewLabel={t('deliveries.view_file')}
          uploadLabel={t('deliveries.upload')}
          deliveryId={delivery.id}
          kind="proof"
          url={proofUrl && proofUrl.ok ? proofUrl.value : null}
          hasFile={Boolean(delivery.proofFileId)}
          open={open}
        />
      </section>
    </div>
  );
}

function FileSlot({
  label,
  uploadedLabel,
  missingLabel,
  viewLabel,
  uploadLabel,
  deliveryId,
  kind,
  url,
  hasFile,
  open,
}: {
  label: string;
  uploadedLabel: string;
  missingLabel: string;
  viewLabel: string;
  uploadLabel: string;
  deliveryId: string;
  kind: 'signature' | 'proof';
  url: string | null;
  hasFile: boolean;
  open: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1 text-sm">
        <span>{label}</span>
        <span className="text-xs text-muted-foreground">
          {hasFile ? uploadedLabel : missingLabel}
          {url ? (
            <>
              {' · '}
              <a href={url} target="_blank" rel="noopener noreferrer" className="underline">{viewLabel}</a>
            </>
          ) : null}
        </span>
      </div>
      {open ? (
        <form action={uploadDeliveryFileForm} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input type="hidden" name="id" value={deliveryId} />
          <input type="hidden" name="kind" value={kind} />
          <input
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            required
            className="text-sm"
          />
          <Button type="submit" variant="outline" size="sm">{uploadLabel}</Button>
        </form>
      ) : null}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm">{value}</dd>
    </div>
  );
}
