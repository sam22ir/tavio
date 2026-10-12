import { RelatedLinks } from '@/ui/views/related-links';
import Link from 'next/link';
import { ErrorToast } from '@/ui/feedback/error-toast';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { formatDzd } from '@/core/money';
import { routing } from '@/i18n/routing';
import { Chatter } from '@/modules/chatter/ui/chatter';
import { SourceContractLink } from '@/modules/purchases/ui/source-contract-link';
import { cancelOrderForm, confirmOrderForm, createBillForm, receiveOrderForm } from '@/modules/purchases/actions';
import { getOrder } from '@/modules/purchases/service/orders';
import { formatQty, parseQty, remainingQty } from '@/modules/purchases/service/math';
import { canBill, canCancel, canConfirm, canReceive } from '@/modules/purchases/service/state';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';

type Locale = 'fr' | 'ar' | 'en';

export default async function PurchaseOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('purchases');
  const tr = await getTranslations();
  const currentLocale = (await getLocale()) as Locale;
  const listHref = `/${currentLocale}/purchases`;
  const rawError = (await searchParams).error;
  const errorCode = typeof rawError === 'string' ? rawError : undefined;

  const result = await withPageCtx((ctx) => getOrder(ctx, id));
  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return (
      <div className="p-4 md:p-6">
        <p role="alert" className="text-sm text-destructive">{t('errors.internal')}</p>
      </div>
    );
  }
  const { order, partnerName, lines, bills } = result.value;
  const anyReceived = lines.some((l) => (parseQty(l.receivedQty) ?? BigInt(0)) > BigInt(0));
  const dateFmt = new Intl.DateTimeFormat(currentLocale, { dateStyle: 'medium', timeZone: 'Africa/Algiers' });

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Link href={listHref} className="text-sm text-muted-foreground hover:underline">
        ← {t('order.title')}
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold break-words">{order.number ?? t('order.draft')}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{partnerName}</span>
          <span>·</span>
          <span>{t(`state.${order.state}`)}</span>
          <span>·</span>
          <span>{dateFmt.format(new Date(`${order.orderDate}T00:00:00Z`))}</span>
          {order.billed ? <span>· {t('order.billed')}</span> : null}
        </div>
      </header>
      <RelatedLinks source="purchases.order" id={id} />

      <Link href={`/${locale}/purchases/${id}/print`} target="_blank" className="w-fit text-sm font-medium underline">
        {t('order.print')}
      </Link>

      <SourceContractLink locale={locale} sourceEntity={order.sourceEntity} sourceId={order.sourceId} />

      {errorCode ? (
        <>
          <p role="alert" className="text-sm text-destructive">
            {tr(`purchases.errors.${errorCode.toLowerCase()}`)}
          </p>
          <ErrorToast message={tr(`purchases.errors.${errorCode.toLowerCase()}`)} />
        </>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {canConfirm(order.state) ? (
          <form action={confirmOrderForm}>
            <input type="hidden" name="id" value={id} />
            <Button type="submit" className="min-h-11">{t('order.actions.confirm')}</Button>
          </form>
        ) : null}
        {canBill(order.state, lines) ? (
          <form action={createBillForm}>
            <input type="hidden" name="id" value={id} />
            <Button type="submit" variant="outline" className="min-h-11">{t('order.actions.bill')}</Button>
          </form>
        ) : null}
        {canCancel(order.state, anyReceived) ? (
          <form action={cancelOrderForm}>
            <input type="hidden" name="id" value={id} />
            <Button type="submit" variant="destructive" className="min-h-11">{t('order.actions.cancel')}</Button>
          </form>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-default/50 text-start">
            <tr>
              <th className="p-3 text-start">{t('fields.description')}</th>
              <th className="p-3 text-end">{t('fields.quantity')}</th>
              <th className="p-3 text-end">{t('fields.received')}</th>
              <th className="p-3 text-end">{t('fields.billed')}</th>
              <th className="p-3 text-end">{t('fields.unitPrice')}</th>
              <th className="p-3 text-end">{t('fields.total')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="p-3">{l.description}</td>
                <td className="p-3 text-end tabular-nums">{l.quantity}</td>
                <td className="p-3 text-end tabular-nums">{l.receivedQty}</td>
                <td className="p-3 text-end tabular-nums">{l.billedQty}</td>
                <td className="p-3 text-end tabular-nums">{formatDzd(l.unitPriceCents, currentLocale)}</td>
                <td className="p-3 text-end tabular-nums">{formatDzd(l.subtotalCents + l.taxCents, currentLocale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="grid w-full max-w-sm grid-cols-2 gap-2 text-sm sm:ms-auto">
        <dt className="text-muted-foreground">{t('fields.untaxed')}</dt>
        <dd className="text-end tabular-nums">{formatDzd(order.untaxedCents, currentLocale)}</dd>
        <dt className="text-muted-foreground">{t('fields.tax')}</dt>
        <dd className="text-end tabular-nums">{formatDzd(order.taxCents, currentLocale)}</dd>
        <dt className="font-medium">{t('fields.total')}</dt>
        <dd className="text-end font-medium tabular-nums">{formatDzd(order.totalCents, currentLocale)}</dd>
      </dl>

      <section className="flex flex-col gap-3 rounded-md border p-4">
        <h2 className="text-base font-medium">{t('bills.title')}</h2>
        {bills.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('bills.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead className="text-start text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">{t('bills.number')}</th>
                  <th className="p-2 text-start">{t('bills.date')}</th>
                  <th className="p-2 text-start">{t('bills.state')}</th>
                  <th className="p-2 text-end">{t('bills.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="p-2">
                      <Link href={`/${currentLocale}/invoicing/vendors/${b.id}`} className="text-primary hover:underline">
                        {b.number ?? t('bills.draftNumber')}
                      </Link>
                    </td>
                    <td className="p-2 tabular-nums">{dateFmt.format(new Date(`${b.date}T00:00:00Z`))}</td>
                    <td className="p-2">{t(`bills.states.${b.state}`)}</td>
                    <td className="p-2 text-end tabular-nums">{formatDzd(b.totalCents, currentLocale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canReceive(order.state) ? (
        <section className="flex flex-col gap-3 rounded-md border p-4">
          <h2 className="text-base font-medium">{t('order.receive.title')}</h2>
          <form action={receiveOrderForm} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={id} />
            {lines
              .filter((l) => remainingQty(l.quantity, l.receivedQty) > BigInt(0))
              .map((l) => (
                <div key={l.id} className="flex flex-col gap-1.5">
                  <label htmlFor={`qty-${l.id}`} className="text-sm">
                    {l.description} · {t('order.receive.remaining')}{' '}
                    {formatQty(remainingQty(l.quantity, l.receivedQty))}
                  </label>
                  <Input id={`qty-${l.id}`} name={`qty-${l.id}`} inputMode="decimal" placeholder="0.000" className="h-11 max-w-xs" />
                </div>
              ))}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" name="mode" value="partial" className="min-h-11">
                {t('order.receive.partial')}
              </Button>
              <Button type="submit" name="mode" value="all" variant="outline" className="min-h-11">
                {t('order.receive.all')}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <Chatter entity="purchases.order" recordId={id} />
    </div>
  );
}
