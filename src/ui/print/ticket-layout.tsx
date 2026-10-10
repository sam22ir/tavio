import { formatDzd, type Cents } from '@/core/money';
import { amountInWords } from '@/core/money/words';
import { DOCUMENT_PRINT_CSS } from './print-styles';
import { groupVatByRate, type VatLine } from './vat';
import type { CompanyIdentity, PrintLocale } from './document-layout';

export interface TicketLine {
  name: string;
  count: number;
  lineCents: Cents;
}

export interface TicketLabels {
  ticket: string;
  ticketNumber: string;
  total: string;
  vat: string;
  base: string;
  totalInWords: string;
  payWith: string;
  change: string;
  nif: string;
  rc: string;
}

export interface TicketLayoutProps {
  locale: PrintLocale;
  labels: TicketLabels;
  company: CompanyIdentity;
  number: string;
  date: string;
  lines: TicketLine[];
  /** VAT per line, used for the by-rate summary. */
  vatLines: VatLine[];
  totalCents: Cents;
  paymentLabel: string;
  changeCents?: Cents | null;
}

/** Compact 80mm receipt. Same company identity as DocumentLayout, reduced to fit the roll. */
export function TicketLayout(props: TicketLayoutProps) {
  const { locale, labels: l, company } = props;
  const money = (c: Cents) => <bdi>{formatDzd(c, locale)}</bdi>;
  const vat = groupVatByRate(props.vatLines);
  return (
    <div lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className="ticket">
      <style dangerouslySetInnerHTML={{ __html: DOCUMENT_PRINT_CSS }} />
      <div className="c">
        <div style={{ fontWeight: 'bold' }}>{company.legalName}</div>
        {company.address ? <div>{company.address}</div> : null}
        {company.phone ? <div><bdi>{company.phone}</bdi></div> : null}
        {company.nif ? <div>{l.nif}: <bdi>{company.nif}</bdi></div> : null}
        {company.rc ? <div>{l.rc}: <bdi>{company.rc}</bdi></div> : null}
      </div>
      <hr />
      <div className="c" style={{ fontWeight: 'bold' }}>{l.ticket}</div>
      <div>{l.ticketNumber}: <bdi>{props.number}</bdi></div>
      <div><bdi>{props.date}</bdi></div>
      <hr />
      {props.lines.map((line, i) => (
        <div key={i} className="row">
          <span>{line.count} x {line.name}</span>
          <span>{money(line.lineCents)}</span>
        </div>
      ))}
      <hr />
      {vat.map((g) => (
        <div key={g.ratePercent} className="row">
          <span>{l.vat} {g.ratePercent}% ({l.base} <bdi>{formatDzd(g.baseCents, locale)}</bdi>)</span>
          <span>{money(g.taxCents)}</span>
        </div>
      ))}
      <div className="row" style={{ fontWeight: 'bold' }}>
        <span>{l.total}</span>
        <span>{money(props.totalCents)}</span>
      </div>
      <div style={{ fontStyle: 'italic' }}>{l.totalInWords}: {amountInWords(props.totalCents, locale)}</div>
      <div>{l.payWith}: {props.paymentLabel}</div>
      {props.changeCents != null ? (
        <div className="row"><span>{l.change}</span><span>{money(props.changeCents)}</span></div>
      ) : null}
    </div>
  );
}
