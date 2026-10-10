import { formatDzd, type Cents } from '@/core/money';
import { amountInWords } from '@/core/money/words';
import { groupVatByRate } from './vat';
import { DOCUMENT_PRINT_CSS } from './print-styles';

export type PrintLocale = 'fr' | 'ar' | 'en';

/** Legal identity of the selling company. Null fields are omitted from the layout. */
export interface CompanyIdentity {
  legalName: string;
  address: string | null;
  wilaya: string | null;
  phone: string | null;
  email: string | null;
  nif: string | null;
  nis: string | null;
  rc: string | null;
  ai: string | null;
  rib?: string | null;
  ccp?: string | null;
  logoUrl?: string | null;
}

export interface PartyIdentity {
  name: string;
  address?: string | null;
  nif?: string | null;
  nis?: string | null;
  rc?: string | null;
  ai?: string | null;
}

export interface DocumentLine {
  description: string;
  quantity: string;
  unitPriceCents: Cents;
  discountRate?: string | null;
  ratePercent: string;
  subtotalCents: Cents;
  taxCents: Cents;
}

export interface DocumentTotals {
  untaxedCents: Cents;
  taxCents: Cents;
  stampCents?: Cents;
  totalCents: Cents;
  /** Shown only when provided (invoices with payments). */
  paidCents?: Cents;
}

/** Every label is passed in already translated; the layout holds no strings of its own. */
export type DocumentLabels = Record<
  | 'seller' | 'buyer' | 'nif' | 'nis' | 'rc' | 'ai' | 'address' | 'phone' | 'email' | 'wilaya'
  | 'number' | 'date' | 'dueDate' | 'description' | 'qty' | 'unit' | 'discount' | 'amount'
  | 'vatRate' | 'vat' | 'base' | 'stampDuty' | 'totalHt' | 'totalTtc' | 'totalInWords'
  | 'paid' | 'balance' | 'page' | 'legal' | 'verify' | 'rib' | 'ccp',
  string
>;

export interface DocumentLayoutProps {
  locale: PrintLocale;
  labels: DocumentLabels;
  title: string;
  number: string;
  date: string;
  dueDate?: string | null;
  company: CompanyIdentity;
  party: PartyIdentity;
  partyRole: 'buyer' | 'seller';
  lines: DocumentLine[];
  totals: DocumentTotals;
  /** Optional legal footer text. Defaults to a placeholder flagged for accountant review. */
  legalText?: string | null;
}

/** Amounts are always LTR, even inside RTL documents. */
function Money({ cents, locale }: { cents: Cents; locale: PrintLocale }) {
  return <bdi>{formatDzd(cents, locale)}</bdi>;
}

function IdLines({ party, labels }: { party: PartyIdentity | CompanyIdentity; labels: DocumentLabels }) {
  const ids: [string, string | null | undefined][] = [
    [labels.nif, party.nif],
    [labels.nis, party.nis],
    [labels.rc, party.rc],
    [labels.ai, party.ai],
  ];
  return (
    <>
      {ids
        .filter((pair): pair is [string, string] => Boolean(pair[1]))
        .map(([label, value]) => (
          <div key={label}>
            {label}: <bdi>{value}</bdi>
          </div>
        ))}
    </>
  );
}

/** Company identity block plus document title, number and dates. Shared by documents and receipts. */
export function DocumentHeader(props: {
  company: CompanyIdentity;
  title: string;
  number: string;
  date: string;
  dueDate?: string | null;
  labels: DocumentLabels;
  locale: PrintLocale;
}) {
  const { company, labels: l } = props;
  return (
    <header className="head row">
      <div className="company">
        {company.logoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={company.logoUrl} alt="" style={{ maxHeight: '18mm', marginBlockEnd: '4px' }} />
          </>
        ) : null}
        <div className="name">{company.legalName}</div>
        {company.address ? <div>{company.address}</div> : null}
        {company.wilaya ? <div>{l.wilaya}: {company.wilaya}</div> : null}
        {company.phone ? <div>{l.phone}: <bdi>{company.phone}</bdi></div> : null}
        {company.email ? <div>{l.email}: <bdi>{company.email}</bdi></div> : null}
        <IdLines party={company} labels={l} />
        {company.rib ? <div>{l.rib}: <bdi>{company.rib}</bdi></div> : null}
        {company.ccp ? <div>{l.ccp}: <bdi>{company.ccp}</bdi></div> : null}
      </div>
      <div style={{ textAlign: 'end' }}>
        <h1>{props.title}</h1>
        <div>{l.number}: <bdi>{props.number}</bdi></div>
        <div>{l.date}: <bdi>{props.date}</bdi></div>
        {props.dueDate ? <div>{l.dueDate}: <bdi>{props.dueDate}</bdi></div> : null}
      </div>
    </header>
  );
}

/**
 * Shared A4 legal document (quote, order, invoice, credit note, receipt).
 * Server-renderable. Print CSS is inlined so the page prints correctly without app chrome.
 */
export function DocumentLayout(props: DocumentLayoutProps) {
  const { locale, labels: l, company, party, totals, lines } = props;
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const showDiscount = lines.some((line) => Number(line.discountRate ?? '0') > 0);
  const vat = groupVatByRate(lines.map((line) => ({ ratePercent: line.ratePercent, baseCents: line.subtotalCents, taxCents: line.taxCents })));
  const stamp = totals.stampCents ?? BigInt(0);
  const hasPayments = totals.paidCents !== undefined && totals.paidCents > BigInt(0);
  const balance = hasPayments ? totals.totalCents - (totals.paidCents as Cents) : null;
  const legal = props.legalText ?? `${l.legal} ${l.verify}`;

  return (
    <div lang={locale} dir={dir} className="doc">
      <style dangerouslySetInnerHTML={{ __html: DOCUMENT_PRINT_CSS }} />

      <DocumentHeader company={company} title={props.title} number={props.number} date={props.date} dueDate={props.dueDate} labels={l} locale={locale} />

      <section className="parties">
        <div className="party">
          <h3>{props.partyRole === 'buyer' ? l.buyer : l.seller}</h3>
          <div style={{ fontWeight: 'bold' }}>{party.name}</div>
          {party.address ? <div>{party.address}</div> : null}
          <IdLines party={party} labels={l} />
        </div>
      </section>

      {lines.length > 0 ? (
      <table>
        <thead>
          <tr>
            <th>{l.description}</th>
            <th className="n">{l.qty}</th>
            <th className="n">{l.unit}</th>
            {showDiscount ? <th className="n">{l.discount}</th> : null}
            <th className="n">{l.totalHt}</th>
            <th className="n">{l.vatRate}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i}>
              <td>{line.description}</td>
              <td className="n"><bdi>{line.quantity}</bdi></td>
              <td className="n"><Money cents={line.unitPriceCents} locale={locale} /></td>
              {showDiscount ? <td className="n"><bdi>{line.discountRate ?? '0'}%</bdi></td> : null}
              <td className="n"><Money cents={line.subtotalCents} locale={locale} /></td>
              <td className="n"><bdi>{String(Number(line.ratePercent))}%</bdi></td>
            </tr>
          ))}
        </tbody>
      </table>
      ) : null}

      <table className="totals">
        <tbody>
          <tr><td>{l.totalHt}</td><td className="n"><Money cents={totals.untaxedCents} locale={locale} /></td></tr>
          {vat.map((g) => (
            <tr key={g.ratePercent}>
              <td>
                {l.vat} {g.ratePercent}% ({l.base}: <bdi>{formatDzd(g.baseCents, locale)}</bdi>)
              </td>
              <td className="n"><Money cents={g.taxCents} locale={locale} /></td>
            </tr>
          ))}
          {stamp > BigInt(0) ? (
            <tr><td>{l.stampDuty}</td><td className="n"><Money cents={stamp} locale={locale} /></td></tr>
          ) : null}
          <tr className="grand"><td>{l.totalTtc}</td><td className="n"><Money cents={totals.totalCents} locale={locale} /></td></tr>
          {hasPayments ? (
            <>
              <tr><td>{l.paid}</td><td className="n"><Money cents={totals.paidCents as Cents} locale={locale} /></td></tr>
              <tr className="grand"><td>{l.balance}</td><td className="n"><Money cents={balance as Cents} locale={locale} /></td></tr>
            </>
          ) : null}
        </tbody>
      </table>

      <p className="words">
        {l.totalInWords}: {amountInWords(totals.totalCents, locale)}
      </p>

      <footer className="footer">
        <div>{legal}</div>
        <div className="row">
          <span>{company.legalName}</span>
          <span>
            {l.page} <span className="page" />
          </span>
        </div>
      </footer>
    </div>
  );
}
