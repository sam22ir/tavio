import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { createDepartmentForm } from '@/modules/hr/actions';
import { listDepartments } from '@/modules/hr/service/employees';
import { DepartmentForm } from '@/modules/hr/ui/department-form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/primitives/table';

export default async function DepartmentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('hr');
  const result = await withPageCtx((ctx) => listDepartments(ctx));

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('department.title')}</h1>
      <DepartmentForm action={createDepartmentForm} />
      {result.ok ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fields.departmentName')}</TableHead>
              <TableHead>{t('fields.active')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.value.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="break-words">{d.name}</TableCell>
                <TableCell>{d.active ? t('fields.yes') : t('fields.no')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {t('department.error')}
        </p>
      )}
    </main>
  );
}
