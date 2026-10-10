import Link from 'next/link';
import { ErrorToast } from '@/ui/feedback/error-toast';
import { formatDzd, type Cents } from '@/core/money';
import type { Invoice, InvoiceLine, InvoicePayment } from '../schema';
import { cancelInvoiceForm, postInvoiceForm, refundInvoiceForm, registerPaymentForm } from '../actions';
import { PAYMENT_METHODS } from '../service/invoices';
import { formatPercent, hasLineDiscount, netPayableCents, residualPayableCents } from '../service/math';

type T = (key: string) => string;
export type Kind = 'customers' | 'vendors';
const inputCls = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
const btnCls = 'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground min-h-11';
const ghostCls = 'rounded-md border px-4 py-2 text-sm min-h-11 inline-flex items-center';

export interface ListRow {
  id: string; number: string | null; date: string; partnerName: string; totalCents: Cents; state: string; paymentState: string; type: string;
}

export function InvoiceList({ rows, kind, locale, t, newHref }: { rows: ListRow[]; kind: Kind; locale: string; t: T; newHref: string }) {
  const base = `/${locale}/invoicing/${kind}`;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Link href={newHref} className={btnCls}>{kind === 'customers' ? t('list.new') : t('list.newVendor')}</Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('list.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-start">
              <tr>
                <th className="p-2 text-start">{t('list.col.number')}</th>
                <th className="p-2 text-start">{t('list.col.date')}</th>
                <th className="p-2 text-start">{t('list.col.partner')}</th>
                <th className="p-2 text-start">{t('list.col.total')}</th>
                <th className="p-2 text-start">{t('list.col.state')}</th>
                <th className="p-2 text-start">{t('list.col.payment')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2"><Link className="underline" href={`${base}/${r.id}`}>{r.number ?? `#${r.id.slice(0, 8)}`}</Link></td>
                  <td className="p-2">{r.date}</td>
                  <td className="p-2">{r.partnerName}</td>
                  <td className="p-2">{formatDzd(r.totalCents, locale as 'fr' | 'ar' | 'en')}</td>
                  <td className="p-2">{t(`state.${r.state}`)}</td>
                  <td className="p-2">{t(`payment.${r.paymentState}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function InvoiceDetail({
  invoice, lines, payments, kind, locale, t, error, partnerName, sellerLabel,
}: {
  invoice: Invoice; lines: InvoiceLine[]; payments: InvoicePayment[]; kind: Kind; locale: string; t: T;
  error?: string; partnerName: string; sellerLabel?: string;
}) {
  const fmt = (c: Cents) => formatDzd(c, locale as 'fr' | 'ar' | 'en');
  // Retenue à la source reduces what is payable to the supplier. ⚠ needs accountant verification
  const netPayable = netPayableCents(invoice.totalCents, invoice.withholdingCents);
  const residual = residualPayableCents(netPayable, invoice.paidCents);
  const kindHref = `/${locale}/invoicing/${kind}`;
  const isDraft = invoice.state === 'draft';
  const isPosted = invoice.state === 'posted';
  const isInvoice = invoice.type === 'out_invoice' || invoice.type === 'in_invoice';
  const showDiscount = lines.some((l) => hasLineDiscount(String(l.discountRate)));
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{invoice.number ?? t('detail.title')}</h1>
          <p className="text-sm text-muted-foreground">{t(`type.${invoice.type}`)} · {partnerName} · {invoice.date}</p>
          {sellerLabel ? <p className="text-xs text-muted-foreground">{sellerLabel}</p> : null}
          <p className="text-sm">{t(`state.${invoice.state}`)} · {t(`payment.${invoice.paymentState}`)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft && isInvoice ? <Link href={`/${locale}/invoicing/${kind}/${invoice.id}/edit`} className={ghostCls}>{t('detail.edit')}</Link> : null}
          {isDraft ? (
            <>
              <form action={postInvoiceForm}><input type="hidden" name="id" value={invoice.id} /><input type="hidden" name="kind" value={kind} /><button className={btnCls}>{t('detail.post')}</button></form>
              <form action={cancelInvoiceForm}><input type="hidden" name="id" value={invoice.id} /><input type="hidden" name="kind" value={kind} /><button className={ghostCls}>{t('detail.cancel')}</button></form>
            </>
          ) : null}
          {isPosted && isInvoice ? (
            <form action={refundInvoiceForm}><input type="hidden" name="id" value={invoice.id} /><input type="hidden" name="kind" value={kind} /><button className={ghostCls}>{t('detail.refund')}</button></form>
          ) : null}
          {isPosted ? <Link href={`/${locale}/invoicing/print/${invoice.id}`} className={ghostCls}>{t('detail.print')}</Link> : null}
        </div>
      </div>
      {error ? <><p role="alert" className="text-sm text-destructive">{t(`error.${error}`)}</p><ErrorToast message={t(`error.${error}`)} /></> : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr><th className="p-2 text-start">{t('form.description')}</th><th className="p-2 text-start">{t('form.quantity')}</th><th className="p-2 text-start">{t('form.unitPrice')}</th>{showDiscount ? <th className="p-2 text-start">{t('form.discount')}</th> : null}</tr></thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-t"><td className="p-2">{l.description}</td><td className="p-2">{String(l.quantity)}</td><td className="p-2">{fmt(l.unitPriceCents)}</td>{showDiscount ? <td className="p-2">{formatPercent(String(l.discountRate))}</td> : null}</tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="grid max-w-sm grid-cols-2 gap-1 text-sm">
        <dt>{t('detail.untaxed')}</dt><dd className="text-end">{fmt(invoice.untaxedCents)}</dd>
        <dt>{t('detail.tax')}</dt><dd className="text-end">{fmt(invoice.taxCents)}</dd>
        <dt>{t('detail.stamp')}</dt><dd className="text-end">{fmt(invoice.stampCents)}</dd>
        <dt className="font-semibold">{t('detail.total')}</dt><dd className="text-end font-semibold">{fmt(invoice.totalCents)}</dd>
        {invoice.withholdingCents > BigInt(0) ? (
          <>
            <dt>{t('detail.withholding')}</dt><dd className="text-end">{fmt(invoice.withholdingCents)}</dd>
            <dt className="font-semibold">{t('detail.netPayable')}</dt><dd className="text-end font-semibold">{fmt(netPayable)}</dd>
          </>
        ) : null}
        <dt>{t('detail.paid')}</dt><dd className="text-end">{fmt(invoice.paidCents)}</dd>
        <dt>{t('detail.residual')}</dt><dd className="text-end">{fmt(residual)}</dd>
      </dl>

      {isPosted && residual > BigInt(0) ? (
        <form action={registerPaymentForm} className="flex max-w-xl flex-col gap-3 rounded-md border p-4">
          <h2 className="font-medium">{t('detail.payment.title')}</h2>
          <input type="hidden" name="id" value={invoice.id} />
          <input type="hidden" name="kind" value={kind} />
          <label className="flex flex-col gap-1 text-sm">{t('detail.payment.amount')}<input name="amount" required inputMode="decimal" defaultValue={(Number(residual) / 100).toFixed(2)} className={inputCls} /></label>
          <label className="flex flex-col gap-1 text-sm">{t('detail.payment.method')}
            <select name="method" className={inputCls}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{t(`method.${m}`)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">{t('detail.payment.date')}<input type="date" name="date" className={inputCls} /></label>
          <label className="flex flex-col gap-1 text-sm">{t('detail.payment.reference')}<input name="reference" maxLength={100} className={inputCls} /></label>
          <button className={btnCls}>{t('detail.payment.submit')}</button>
        </form>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">{t('detail.payments')}</h2>
        {payments.length === 0 ? <p className="text-sm text-muted-foreground">{t('detail.noPayments')}</p> : (
          <ul className="text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <span>{p.date} · {t(`method.${p.method}`)} · {fmt(p.amountCents)}{p.reference ? ` · ${p.reference}` : ''}</span>
                <Link href={`/${locale}/invoicing/payments/${p.id}/print`} target="_blank" className="underline">{t('detail.printReceipt')}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Link href={kindHref} className="text-sm underline">{t('list.' + kind)}</Link>
    </div>
  );
}
