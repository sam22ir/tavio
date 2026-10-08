'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/core/auth/session';
import { err, ok, type Result } from '@/core/result';
import { setActiveCompanyId } from '@/core/tenancy/active';
import { listMyCompanies } from '@/core/tenancy/service';

/** Switches the active company after checking the user has an active membership in it. */
export async function switchCompany(companyId: string): Promise<Result<{ companyId: string }>> {
  const user = await requireUser();
  if (!user.ok) return user;
  if (typeof companyId !== 'string' || companyId.length === 0) {
    return err('VALIDATION', 'companyId is required');
  }
  const mine = await listMyCompanies(user.value.userId);
  if (!mine.some((c) => c.id === companyId)) return err('FORBIDDEN', 'Not a member of this company');
  await setActiveCompanyId(companyId);
  revalidatePath('/', 'layout');
  return ok({ companyId });
}
