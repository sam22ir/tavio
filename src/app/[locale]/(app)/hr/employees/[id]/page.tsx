import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { toggleEmployeeActiveForm, updateEmployeeForm } from '@/modules/hr/actions';
import { getEmployee, employeeOptions, listDepartments } from '@/modules/hr/service/employees';
import { Chatter } from '@/modules/chatter/ui/chatter';
import { EmployeeForm } from '@/modules/hr/ui/employee-form';
import { Button } from '@/ui/primitives/button';

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('hr');
  const currentLocale = await getLocale();
  const listHref = `/${currentLocale}/hr/employees`;

  const data = await withPageCtx(async (ctx) => {
    const emp = await getEmployee(ctx, id);
    if (!emp.ok) return { emp } as const;
    const [depts, people] = await Promise.all([listDepartments(ctx), employeeOptions(ctx)]);
    return { emp, depts, people } as const;
  });

  if (!data.emp.ok) {
    if (data.emp.error.code === 'NOT_FOUND') notFound();
    return (
      <main className="p-4 md:p-6">
        <p role="alert" className="text-sm text-destructive">
          {t('employee.error')}
        </p>
      </main>
    );
  }
  const emp = data.emp.value;
  const depts = data.depts?.ok ? data.depts.value : [];
  const people = data.people?.ok ? data.people.value : [];

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <Link href={listHref} className="text-sm text-muted-foreground hover:underline">
        ← {t('employee.title')}
      </Link>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold break-words">{emp.displayName}</h1>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            {emp.jobTitle ? <span>{emp.jobTitle}</span> : null}
            {emp.departmentName ? <span>· {emp.departmentName}</span> : null}
            {emp.active ? null : <span className="text-destructive">{t('fields.archived')}</span>}
          </div>
        </div>
        <form action={toggleEmployeeActiveForm}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="active" value={emp.active ? 'false' : 'true'} />
          <Button type="submit" variant="outline">
            {emp.active ? t('actions.archive') : t('actions.reactivate')}
          </Button>
        </form>
      </header>

      <section aria-labelledby="employee-edit" className="flex flex-col gap-3">
        <h2 id="employee-edit" className="text-base font-semibold">
          {t('employee.edit')}
        </h2>
        <div className="max-w-2xl">
          <EmployeeForm
            action={updateEmployeeForm}
            values={{ ...emp, id }}
            departments={depts.map((d) => ({ value: d.id, label: d.name }))}
            managers={people}
          />
        </div>
      </section>

      <section aria-labelledby="employee-activity" className="flex flex-col gap-3">
        <h2 id="employee-activity" className="text-base font-semibold">
          {t('employee.activity')}
        </h2>
        <Chatter entity="hr.employee" recordId={id} />
      </section>
    </main>
  );
}
