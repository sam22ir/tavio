'use server';

import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import type { Locale } from '@/core/ctx';
import { err, ok, type Result } from '@/core/result';
import { tenantForUser } from '@/core/tenancy/tenant-access';
import { clearSampleRecords, seedSampleData } from './sample-data';

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

/** Loads the sample company data into the given company (owner or admin only). */
export async function seedSampleDataAction(companyId: string): Promise<Result<{ recorded: number }>> {
  const tenant = await tenantForUser({ locale: await currentLocale(), companyId, needManage: true });
  if (!tenant.ok) return tenant;
  try {
    const result = await seedSampleData(tenant.value);
    refresh();
    return ok(result);
  } catch {
    return err('INTERNAL', 'sample data could not be loaded');
  }
}

/** Removes every recorded sample row of the active company. Owner or admin only. */
export async function clearSampleData(): Promise<Result<{ deleted: number }>> {
  const tenant = await tenantForUser({ locale: await currentLocale(), needManage: true });
  if (!tenant.ok) return tenant;
  try {
    const deleted = await clearSampleRecords(tenant.value);
    refresh();
    return ok({ deleted });
  } catch {
    // The transaction rolled back: some sample row is referenced by data created since.
    return err('CONFLICT', 'sample rows are still referenced');
  }
}
