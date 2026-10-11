import { DocumentHeader, type CompanyIdentity, type DocumentLabels, type PartyIdentity, type PrintLocale } from './document-layout';
import { DOCUMENT_PRINT_CSS } from './print-styles';

/** One line of a delivery note. Quantities are decimal strings. No prices on a delivery note. */
export interface DeliveryNoteLine {
  description: string;
  ordered: string;
  delivered: string;
  remaining: string;
}

/** Labels specific to the delivery note, already translated. */
export interface DeliveryNoteLabels {
  qtyOrdered: string;
  qtyDelivered: string;
  qtyRemaining: string;
  deliveryAddress: string;
  originBackorder: string;
  signatureDeliverer: string;
  signatureReceiver: string;
}

export interface DeliveryNoteProps {
  locale: PrintLocale;
  labels: DocumentLabels;
  extra: DeliveryNoteLabels;
  title: string;
  number: string;
  date: string;
  company: CompanyIdentity;
  customer: PartyIdentity;
  deliveryAddress?: string | null;
  lines: DeliveryNoteLine[];
  originNumber?: string | null;
}

/**
 * Delivery note (bon de livraison) on the shared print styles and header. Shows ordered, delivered and
 * remaining quantities, the customer and delivery address, and the two signature blocks. No prices.
 */
export function DeliveryNoteLayout(props: DeliveryNoteProps) {
  const { locale, labels: l, extra: x, company, customer, lines } = props;
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const address = props.deliveryAddress ?? customer.address ?? null;

  return (
    <div lang={locale} dir={dir} className="doc">
      <style dangerouslySetInnerHTML={{ __html: DOCUMENT_PRINT_CSS }} />
      <DocumentHeader company={company} title={props.title} number={props.number} date={props.date} labels={l} locale={locale} />

      <section className="parties">
        <div className="party">
          <h3>{l.buyer}</h3>
          <div style={{ fontWeight: 'bold' }}>{customer.name}</div>
          {address ? (
            <div>
              {x.deliveryAddress}: {address}
            </div>
          ) : null}
          {customer.nif ? <div>{l.nif}: {customer.nif}</div> : null}
        </div>
      </section>

      {props.originNumber ? (
        <p>
          {x.originBackorder} {props.originNumber}
        </p>
      ) : null}

      <table>
        <thead>
          <tr>
            <th>{l.description}</th>
            <th className="n">{x.qtyOrdered}</th>
            <th className="n">{x.qtyDelivered}</th>
            <th className="n">{x.qtyRemaining}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i}>
              <td>{line.description}</td>
              <td className="n"><bdi>{line.ordered}</bdi></td>
              <td className="n"><bdi>{line.delivered}</bdi></td>
              <td className="n"><bdi>{line.remaining}</bdi></td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="parties" style={{ marginTop: '18mm' }}>
        <div className="party">
          <h3>{x.signatureDeliverer}</h3>
          <div style={{ height: '20mm' }} />
        </div>
        <div className="party">
          <h3>{x.signatureReceiver}</h3>
          <div style={{ height: '20mm' }} />
        </div>
      </section>
    </div>
  );
}
