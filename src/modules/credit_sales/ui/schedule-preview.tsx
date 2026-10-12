import { formatDzd, type Cents } from '@/core/money';
import type { Locale } from '@/core/ctx';
import type { ScheduleLine } from '../service/schedule';

interface Props {
  lines: ScheduleLine[];
  locale: Locale;
  labels: { seq: string; dueDate: string; amount: string; empty: string };
}

/** Presentational list of schedule lines. Pure: the caller computes lines with buildSchedule. */
export function SchedulePreview({ lines, locale, labels }: Props) {
  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.empty}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-default/50">
          <tr>
            <th scope="col" className="px-3 py-2 text-start font-medium">{labels.seq}</th>
            <th scope="col" className="px-3 py-2 text-start font-medium">{labels.dueDate}</th>
            <th scope="col" className="px-3 py-2 text-end font-medium">{labels.amount}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.seq} className="border-t">
              <td className="px-3 py-2">{l.seq}</td>
              <td className="px-3 py-2 tabular-nums" dir="ltr">{l.dueDate}</td>
              <td className="px-3 py-2 text-end tabular-nums">{formatDzd(l.amountCents as Cents, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
