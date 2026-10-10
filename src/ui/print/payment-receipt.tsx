import { formatDzd, type Cents } from '@/core/money';
import { amountInWords } from '@/core/money/words';
import { DOCUMENT_PRINT_CSS } from './print-styles';
import { DocumentHeader, type CompanyIdentity, type DocumentLabels, type PartyIdentity, type PrintLocale } from './document-layout';

export interface PaymentReceiptProps {
  locale: PrintLocale;
  labels: DocumentLabels;
  receiptTitle: string;
  receiptNumber: string;
  paymentDate: string;
  methodLabel: string;
  reference?: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  company: CompanyIdentity;
  payer: PartyIdentity;
  amountCents: Cents;
  invoiceTotalCents: Cents;
  /** Total paid on the invoice including this payment. */
  paidToDateCents: Cents;
  labelsExtra: { invoice: string; payer: string; method: string; amountPaid: string; remaining: string; receiptWords: string; reference: string; paymentDate: string };
}

/** One payment as an A4 receipt: identity, payer, invoice, amount in words, remaining balance. */
export function PaymentReceipt(p: PaymentReceiptProps) {
  const { locale, labels: l, labelsExtra: x, company, payer } = p;
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const balance = p.invoiceTotalCents - p.paidToDateCents;
  const money = (c: Cents) => <bdi>{formatDzd(c, locale)}</bdi>;
  return (
    <div lang={locale} dir={dir} className="doc">
      <style dangerouslySetInnerHTML={{ __html: DOCUMENT_PRINT_CSS }} />
      <DocumentHeader company={company} title={p.receiptTitle} number={p.receiptNumber} date={p.paymentDate} labels={l} locale={locale} />

      <section className="parties">
        <div className="party">
          <h3>{x.payer}</h3>
          <div style={{ fontWeight: 'bold' }}>{payer.name}</div>
          {payer.address ? <div>{payer.address}</div> : null}
          {payer.nif ? <div>{l.nif}: <bdi>{payer.nif}</bdi></div> : null}
        </div>
        <div className="party">
          <h3>{x.invoice}</h3>
          <div>{x.invoice}: <bdi>{p.invoiceNumber}</bdi></div>
          <div>{l.date}: <bdi>{p.invoiceDate}</bdi></div>
          <div>{x.method}: {p.methodLabel}</div>
          {p.reference ? <div>{x.reference}: <bdi>{p.reference}</bdi></div> : null}
        </div>
      </section>

      <table className="totals">
        <tbody>
          <tr><td>{x.invoice} {l.totalTtc}</td><td className="n">{money(p.invoiceTotalCents)}</td></tr>
          <tr><td>{x.amountPaid}</td><td className="n">{money(p.amountCents)}</td></tr>
          <tr><td>{l.paid}</td><td className="n">{money(p.paidToDateCents)}</td></tr>
          <tr className="grand"><td>{x.remaining}</td><td className="n">{money(balance)}</td></tr>
        </tbody>
      </table>

      <p className="words">
        {x.receiptWords}: {amountInWords(p.amountCents, locale)}
      </p>

      <footer className="footer">
        <div>{l.legal} {l.verify}</div>
      </footer>
    </div>
  );
}
