'use server';

import { redirect } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { requireUser } from '@/core/auth/session';
import { setActiveCompanyId } from '@/core/tenancy/active';
import { createCompany } from '@/core/tenancy/service';
import { routing } from '@/i18n/routing';

function optional(value: FormDataEntryValue | null): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export async function createCompanyAction(formData: FormData): Promise<void> {
  const rawLocale = String(formData.get('locale') ?? '');
  const locale = hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale;

  const user = await requireUser();
  if (!user.ok) redirect(`/${locale}/login`);

  const result = await createCompany(user.value.userId, {
    legalName: String(formData.get('legalName') ?? '').trim(),
    phone: optional(formData.get('phone')),
    address: optional(formData.get('address')),
    wilayaCode: optional(formData.get('wilayaCode')),
  });
  if (!result.ok) redirect(`/${locale}/onboarding?error=${result.error.code}`);

  await setActiveCompanyId(result.value.companyId);
  redirect(`/${locale}/dashboard`);
}
