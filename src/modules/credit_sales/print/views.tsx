import type { ContractPrintInput } from './contract-html';
import type { ReceiptPrintInput } from './receipt-html';
import { PRINT_CSS } from './print-styles';
import { dirFor, formatDate, labels, methodLabel, money } from './shared';

// React rendering of the same content as the HTML builders. Used by the print pages.

export function ReceiptView({ input }: { input: ReceiptPrintInput }) {
  const t = labels(input.locale);
  const { company, partner } = input;
  return (
    <div dir={dirFor(input.locale)} className="receipt print-area mx-auto max-w-[148mm] bg-white p-4 text-black">
      <style>{PRINT_CSS}</style>
      <div className="head flex justify-between gap-3 border-b-2 border-black pb-2">
        <div>
          <h1 className="text-lg font-semibold">{company.legalName}</h1>
          {/* ⚠ needs accountant/lawyer verification */}
          <div>{t.nif}: {company.nif ?? '—'} · {t.rc}: {company.rc ?? '—'}</div>
          <div>{t.address}: {company.address ?? '—'}</div>
        </div>
        <div className="text-end">
          <div><strong>{t.receipt}</strong></div>
          <div>{t.number} {input.number}</div>
          <div>{t.issuedAt}: {formatDate(input.issuedAt, input.locale)}</div>
          {input.voided ? <div className="font-bold text-red-700">{t.voided}</div> : null}
        </div>
      </div>
      <div className="mt-3"><strong>{t.client}:</strong> {partner.name}</div>
      <div>{t.phone}: {partner.phone ?? '—'}</div>
      <table className="mt-3 w-full text-start">
        <tbody>
          <tr><th className="text-start">{t.method}</th><td>{methodLabel(input.method, input.locale)}</td></tr>
          <tr><th className="text-start">{t.reference}</th><td>{input.reference}</td></tr>
          {input.contractReference ? (
            <tr><th className="text-start">{t.contract}</th><td>{input.contractReference}</td></tr>
          ) : null}
        </tbody>
      </table>
      <div className="mt-4 flex justify-between border border-black p-2 text-base">
        <strong>{t.total}</strong>
        <strong>{money(input.totalCents, input.locale)}</strong>
      </div>
      {/* ⚠ needs accountant/lawyer verification */}
      <div className="sig mt-10 text-center"><div className="border-t border-black pt-1">{t.signature}</div></div>
    </div>
  );
}

export function ContractView({ input }: { input: ContractPrintInput }) {
  const t = labels(input.locale);
  const { company, partner } = input;
  const freq = input.frequency === 'weekly' ? t.weekly : t.monthly;
  return (
    <div dir={dirFor(input.locale)} className="contract print-area mx-auto max-w-[190mm] bg-white p-4 text-black">
      <style>{PRINT_CSS}</style>
      <div className="head flex justify-between gap-3 border-b-2 border-black pb-2">
        <div>
          <h1 className="text-lg font-semibold">{company.legalName}</h1>
          {/* ⚠ needs accountant/lawyer verification */}
          <div>{t.nif}: {company.nif ?? '—'} · {t.rc}: {company.rc ?? '—'}</div>
          <div>{t.address}: {company.address ?? '—'}</div>
        </div>
        <div className="text-end">
          <div><strong>{t.contractTitle}</strong></div>
          <div>{t.number} {input.reference}</div>
          <div>{t.startDate}: {formatDate(input.startDate, input.locale)}</div>
          <div>{t.frequency}: {freq} · {input.installmentsCount}</div>
        </div>
      </div>
      <div className="mt-3"><strong>{t.client}:</strong> {partner.name}</div>
      <div>{t.phone}: {partner.phone ?? '—'}</div>

      <h2 className="mt-4 font-semibold">{t.lines}</h2>
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-start">{t.seq}</th>
            <th className="text-start">{t.description}</th>
            <th className="text-end">{t.quantity}</th>
            <th className="text-end">{t.unitPrice}</th>
            <th className="text-end">{t.lineTotal}</th>
          </tr>
        </thead>
        <tbody>
          {input.lines.map((l, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{l.description}</td>
              <td className="text-end">{l.quantity}</td>
              <td className="text-end">{money(l.unitPriceCents, input.locale)}</td>
              <td className="text-end">{money(l.lineTotalCents, input.locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-4 font-semibold">{t.total2}</h2>
      <table className="w-full">
        <tbody>
          <tr><th className="text-start">{t.cashPrice}</th><td className="text-end">{money(input.cashPriceCents, input.locale)}</td></tr>
          <tr><th className="text-start">{t.markup}</th><td className="text-end">{money(input.markupCents, input.locale)}</td></tr>
          <tr><th className="text-start">{t.total2}</th><td className="text-end">{money(input.totalCents, input.locale)}</td></tr>
          <tr><th className="text-start">{t.downPayment}</th><td className="text-end">{money(input.downPaymentCents, input.locale)}</td></tr>
          <tr><th className="text-start">{t.financed}</th><td className="text-end">{money(input.financedCents, input.locale)}</td></tr>
        </tbody>
      </table>

      <h2 className="mt-4 font-semibold">{t.schedule}</h2>
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-start">{t.seq}</th>
            <th className="text-start">{t.dueDate}</th>
            <th className="text-end">{t.amount}</th>
          </tr>
        </thead>
        <tbody>
          {input.schedule.map((s) => (
            <tr key={s.seq}>
              <td>{s.seq}</td>
              <td>{formatDate(s.dueDate, input.locale)}</td>
              <td className="text-end">{money(s.amountCents, input.locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-4 font-semibold">{t.terms}</h2>
      {/* ⚠ needs accountant/lawyer verification */}
      <div className="box border border-neutral-500 p-2">{t.termsPlaceholder}</div>

      <div className="sig mt-10 flex justify-between gap-6">
        <div className="flex-1 border-t border-black pt-1 text-center">{t.sellerSignature}</div>
        <div className="flex-1 border-t border-black pt-1 text-center">{t.buyerSignature}</div>
      </div>
    </div>
  );
}
