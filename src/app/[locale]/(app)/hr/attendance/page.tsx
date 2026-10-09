import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ErrorToast } from '@/ui/feedback/error-toast';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { checkInSelfForm, checkOutSelfForm } from '@/modules/hr/actions';
import { listAttendance, monthlyAttendanceSummary, openSpan } from '@/modules/hr/service/attendance';
import { employeeOptions, getEmployeeForUser } from '@/modules/hr/service/employees';
import { minutesToHours } from '@/modules/hr/logic';
import { Button } from '@/ui/primitives/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/primitives/table';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const sp = await searchParams;
  const rawMonth = typeof sp.month === 'string' ? sp.month : '';
  const month = MONTH_RE.test(rawMonth) ? rawMonth : new Date().toISOString().slice(0, 7);
  const t = await getTranslations('hr');
  const tViews = await getTranslations('views');
  const failed = typeof sp.error === 'string';

  const data = await withPageCtx(async (ctx) => {
    const me = await getEmployeeForUser(ctx);
    const [spans, summary, people] = await Promise.all([
      listAttendance(ctx),
      monthlyAttendanceSummary(ctx, month),
      employeeOptions(ctx),
    ]);
    const open = me.ok ? await openSpan(ctx, me.value.id) : null;
    return { me, spans, summary, people, open };
  });

  const names = new Map(data.people.ok ? data.people.value.map((p) => [p.value, p.label]) : []);
  const checkedIn = data.open?.ok && data.open.value !== null;

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      {failed ? <ErrorToast message={tViews('error')} /> : null}
      <h1 className="text-xl font-semibold">{t('attendance.title')}</h1>

      <section aria-labelledby="attendance-self" className="flex flex-col items-start gap-3 rounded-md border p-4">
        <h2 id="attendance-self" className="text-base font-semibold">
          {t('attendance.mine')}
        </h2>
        {data.me.ok ? (
          checkedIn ? (
            <form action={checkOutSelfForm} className="w-full sm:w-auto">
              <Button type="submit" variant="destructive" className="h-16 w-full px-10 text-lg sm:w-auto">
                {t('attendance.checkOut')}
              </Button>
            </form>
          ) : (
            <form action={checkInSelfForm} className="w-full sm:w-auto">
              <Button type="submit" className="h-16 w-full px-10 text-lg sm:w-auto">
                {t('attendance.checkIn')}
              </Button>
            </form>
          )
        ) : (
          <p className="text-sm text-muted-foreground">{t('attendance.noEmployee')}</p>
        )}
      </section>

      <section aria-labelledby="attendance-summary" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="attendance-summary" className="text-base font-semibold">
            {t('attendance.summary')}
          </h2>
          <form method="get" className="flex items-end gap-2">
            <label className="flex flex-col text-xs text-muted-foreground">
              {t('attendance.month')}
              <input type="month" name="month" defaultValue={month} className="h-9 rounded-md border bg-transparent px-2 text-sm" />
            </label>
            <Button type="submit" variant="outline" size="sm">
              {t('actions.show')}
            </Button>
          </form>
        </div>
        {data.summary.ok ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('fields.employee')}</TableHead>
                  <TableHead>{t('attendance.daysPresent')}</TableHead>
                  <TableHead>{t('attendance.hours')}</TableHead>
                  <TableHead>{t('attendance.open')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.summary.value.map((row) => (
                  <TableRow key={row.employeeId}>
                    <TableCell className="break-words">{names.get(row.employeeId) ?? '–'}</TableCell>
                    <TableCell>{row.daysPresent}</TableCell>
                    <TableCell>{minutesToHours(row.minutes)}</TableCell>
                    <TableCell>{row.openCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p role="alert" className="text-sm text-destructive">
            {t('attendance.error')}
          </p>
        )}
      </section>

      <section aria-labelledby="attendance-recent" className="flex flex-col gap-3">
        <h2 id="attendance-recent" className="text-base font-semibold">
          {t('attendance.recent')}
        </h2>
        {data.spans.ok ? (
          <ul className="flex flex-col divide-y rounded-md border">
            {data.spans.value.slice(0, 50).map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-2 p-3 text-sm">
                <span className="break-words">{s.employeeName}</span>
                <span className="text-muted-foreground">
                  {s.checkIn.toLocaleString(locale)}
                  {' – '}
                  {s.checkOut ? s.checkOut.toLocaleString(locale) : t('attendance.open')}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p role="alert" className="text-sm text-destructive">
            {t('attendance.error')}
          </p>
        )}
      </section>
    </main>
  );
}
