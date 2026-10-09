import { getLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';

export default async function HrIndexPage() {
  const locale = await getLocale();
  redirect(`/${locale}/hr/employees`);
}
