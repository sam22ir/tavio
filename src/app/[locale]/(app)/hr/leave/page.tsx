import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ErrorToast } from '@/ui/feedback/error-toast';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import {
  createLeaveForm,
  createLeaveTypeForm,
  decideLeaveForm,
  submitLeaveForm,
} from '@/modules/hr/actions';
import { listLeaveRequests, listLeaveTypes } from '@/modules/hr/service/leave';
import { employeeOptions } from '@/modules/hr/service/employees';
import { LeaveRequestForm, LeaveTypeForm } from '@/modules/hr/ui/leave-form';
import { Button } from '@/ui/primitives/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/primitives/table';

export default async function LeavePage({
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
  const state = typeof sp.state === 'string' ? sp.state : undefined;
  const employeeId = typeof sp.f_employeeId === 'string' ? sp.f_employeeId : undefined;
  const t = await getTranslations('hr');
  const tViews = await getTranslations('views');
  const failed = typeof sp.error === 'string';

  const data = await withPageCtx(async (ctx) => {
    const [requests, types, people] = await Promise.all([
      listLeaveRequests(ctx, { state, employeeId }),
      listLeaveTypes(ctx),
      employeeOptions(ctx),
    ]);
    return { requests, types, people };
  });

  const requests = data.requests.ok ? data.requests.value : null;
  const types = data.types.ok ? data.types.value : null;
  const people = data.people.ok ? data.people.value : null;
  const stateLabel = (s: string) => t(`options.leaveState.${s}`);

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      {failed ? <ErrorToast message={tViews('error')} /> : null}
      <h1 className="text-xl font-semibold">{t('leave.title')}</h1>

      {requests && types && people ? (
        <>
          <section aria-labelledby="leave-new" className="flex flex-col gap-3">
            <h2 id="leave-new" className="text-base font-semibold">
              {t('leave.new')}
            </h2>
            <div className="max-w-2xl">
              <LeaveRequestForm
                action={createLeaveForm}
                employees={people}
                types={types.map((x) => ({ value: x.id, label: x.name }))}
              />
            </div>
          </section>

          <section aria-labelledby="leave-types" className="flex flex-col gap-3">
            <h2 id="leave-types" className="text-base font-semibold">
              {t('leave.types')}
            </h2>
            <LeaveTypeForm action={createLeaveTypeForm} />
          </section>

          <section aria-labelledby="leave-list" className="flex flex-col gap-3">
            <h2 id="leave-list" className="text-base font-semibold">
              {t('leave.list')}
            </h2>
            <nav className="flex flex-wrap gap-2 text-sm" aria-label={t('leave.filter')}>
              {['', 'submitted', 'approved', 'refused', 'draft'].map((s) => (
                <a
                  key={s || 'all'}
                  href={s ? `?state=${s}` : '?'}
                  aria-current={(state ?? '') === s ? 'page' : undefined}
                  className="rounded-md border px-3 py-1 hover:bg-default aria-[current=page]:bg-default"
                >
                  {s ? stateLabel(s) : t('leave.all')}
                </a>
              ))}
            </nav>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('fields.employee')}</TableHead>
                    <TableHead>{t('fields.leaveType')}</TableHead>
                    <TableHead>{t('fields.period')}</TableHead>
                    <TableHead>{t('fields.days')}</TableHead>
                    <TableHead>{t('fields.state')}</TableHead>
                    <TableHead>{t('actions.label')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="break-words">{r.employeeName}</TableCell>
                      <TableCell>{r.typeName}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.fromDate} → {r.toDate}
                      </TableCell>
                      <TableCell>{Number(r.days).toFixed(0)}</TableCell>
                      <TableCell>{stateLabel(r.state)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {r.state === 'draft' ? (
                            <form action={submitLeaveForm}>
                              <input type="hidden" name="id" value={r.id} />
                              <Button type="submit" size="sm" variant="outline">
                                {t('actions.submit')}
                              </Button>
                            </form>
                          ) : null}
                          {r.state === 'submitted' ? (
                            <>
                              <form action={decideLeaveForm}>
                                <input type="hidden" name="id" value={r.id} />
                                <input type="hidden" name="decision" value="approved" />
                                <Button type="submit" size="sm">
                                  {t('actions.approve')}
                                </Button>
                              </form>
                              <form action={decideLeaveForm}>
                                <input type="hidden" name="id" value={r.id} />
                                <input type="hidden" name="decision" value="refused" />
                                <Button type="submit" size="sm" variant="outline">
                                  {t('actions.refuse')}
                                </Button>
                              </form>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {t('leave.error')}
        </p>
      )}
    </main>
  );
}
