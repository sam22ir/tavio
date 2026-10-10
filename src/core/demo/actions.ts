'use server';

import { revalidatePath } from 'next/cache';
import { getLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/core/ctx';
import { requireUser } from '@/core/auth/session';
import { err, ok, type Result } from '@/core/result';
import { getActiveCompanyId, setActiveCompanyId } from '@/core/tenancy/active';
import { tenantForUser } from '@/core/tenancy/tenant-access';
import { archiveDemoCompany, homeCompanyOf } from '@/core/tenancy/service';
import { createSampleCompany } from './demo-company';

function refresh(): void {
  try {
    revalidatePath('/', 'layout');
  } catch {
    // Outside a request context. Nothing to invalidate.
  }
}

async function currentLocale(): Promise<Locale> {
  const l = await getLocale();
  return l === 'ar' || l === 'en' ? l : 'fr';
}

/**
 * Creates a demo company for the user, seeds it with sample data and makes it the active company.
 * The company given (the user's real one) stays empty. Owner or admin only.
 */
export async function seedSampleDataAction(companyId: string): Promise<Result<{ companyId: string }>> {
  const locale = await currentLocale();
  const tenant = await tenantForUser({ locale, companyId, needManage: true });
  if (!tenant.ok) return tenant;
  try {
    const t = await getTranslations({ locale, namespace: 'onboarding' });
    const created = await createSampleCompany({
      userId: tenant.value.userId,
      sourceCompanyId: companyId,
      legalName: t('demo.companyName'),
      locale,
    });
    if (!created.ok) return created;
    await setActiveCompanyId(created.value.companyId);
    refresh();
    return ok({ companyId: created.value.companyId });
  } catch {
    return err('INTERNAL', 'sample data could not be loaded');
  }
}

/** Archives a demo company of the user (owner only). No data is deleted. Switches back to the user's real company. */
export async function archiveDemoCompanyAction(companyId: string): Promise<Result<{ companyId: string }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  const archived = await archiveDemoCompany(user.value.userId, companyId);
  if (!archived.ok) return archived;
  if ((await getActiveCompanyId()) === companyId) {
    const home = await homeCompanyOf(user.value.userId);
    if (home) await setActiveCompanyId(home.id);
  }
  refresh();
  return ok({ companyId });
}
