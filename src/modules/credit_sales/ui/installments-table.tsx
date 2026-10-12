import { formatDzd, type Cents } from '@/core/money';
import type { Locale } from '@/core/ctx';
import type { InstallmentStatus } from '../service/contracts';

export interface InstallmentRow {
  id: string;
  seq: number;
  dueDate: string;
  amountCents: bigint;
  paidCents: bigint;
  status: InstallmentStatus;
}

const STATUS_CLASS: Record<InstallmentStatus, string> = {
  upcoming: 'bg-default text-muted-foreground',
  partial: 'bg-tint-warning text-tint-warning-fg',
  paid: 'bg-tint-success text-tint-success-fg',
  late: 'bg-tint-danger text-tint-danger-fg',
};

interface Props {
  rows: InstallmentRow[];
  locale: Locale;
  labels: {
    seq: string;
    dueDate: string;
    amount: string;
    paid: string;
    statusHeader: string;
    status: Record<InstallmentStatus, string>;
    empty: string;
  };
}

export function InstallmentsTable({ rows, locale, labels }: Props) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{labels.empty}</p>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-default/50">
          <tr>
            <th scope="col" className="px-3 py-2 text-start font-medium">{labels.seq}</th>
            <th scope="col" className="px-3 py-2 text-start font-medium">{labels.dueDate}</th>
            <th scope="col" className="px-3 py-2 text-end font-medium">{labels.amount}</th>
            <th scope="col" className="px-3 py-2 text-end font-medium">{labels.paid}</th>
            <th scope="col" className="px-3 py-2 text-start font-medium">{labels.statusHeader}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-2">{r.seq}</td>
              <td className="px-3 py-2 tabular-nums" dir="ltr">{r.dueDate}</td>
              <td className="px-3 py-2 text-end tabular-nums">{formatDzd(r.amountCents as Cents, locale)}</td>
              <td className="px-3 py-2 text-end tabular-nums">{formatDzd(r.paidCents as Cents, locale)}</td>
              <td className="px-3 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}>
                  {labels.status[r.status]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
