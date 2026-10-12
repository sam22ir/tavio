import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { createEmployeeForm } from '@/modules/hr/actions';
import { employeeOptions, listDepartments } from '@/modules/hr/service/employees';
import { EmployeeForm } from '@/modules/hr/ui/employee-form';

export default async function NewEmployeePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('hr');
  const currentLocale = await getLocale();
  const [depts, people] = await withPageCtx(async (ctx) => [await listDepartments(ctx), await employeeOptions(ctx)] as const);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Link href={`/${currentLocale}/hr/employees`} className="text-sm text-muted hover:underline">
        ← {t('employee.title')}
      </Link>
      <h1 className="text-xl font-semibold">{t('employee.new')}</h1>
      {depts.ok && people.ok ? (
        <div className="max-w-2xl">
          <EmployeeForm
            action={createEmployeeForm}
            departments={depts.value.map((d) => ({ value: d.id, label: d.name }))}
            managers={people.value}
          />
        </div>
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {t('employee.error')}
        </p>
      )}
    </div>
  );
}
