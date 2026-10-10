// Creates a demo company for a user: a separate company with the same business type, filled with sample data.
// The user's real company is never touched.
import { eq } from 'drizzle-orm';
import { getDb } from '@/core/db/client';
import { companies } from '@/core/db/schema';
import type { Db } from '@/core/db/types';
import type { Locale } from '@/core/ctx';
import { err, type Result } from '@/core/result';
import { createCompany, loadTenantArgs } from '@/core/tenancy/service';
import { seedSampleData } from './sample-data';

/** Creates a demo company (owner: userId) from a real company's business type, then seeds it. */
export async function createSampleCompany(
  args: { userId: string; sourceCompanyId: string; legalName: string; locale: Locale },
  db: Db = getDb(),
): Promise<Result<{ companyId: string }>> {
  const [source] = await db
    .select({ businessType: companies.businessType, isDemo: companies.isDemo, archivedAt: companies.archivedAt })
    .from(companies)
    .where(eq(companies.id, args.sourceCompanyId));
  if (!source || source.isDemo || source.archivedAt) return err('FORBIDDEN', 'sample data needs a real company');

  const created = await createCompany(
    args.userId,
    { legalName: args.legalName, businessType: source.businessType ?? undefined, isDemo: true },
    db,
  );
  if (!created.ok) return created;

  const tenant = await loadTenantArgs(args.userId, created.value.companyId, args.locale, db);
  if (!tenant.ok) return tenant;
  await seedSampleData(tenant.value, db);
  return created;
}
