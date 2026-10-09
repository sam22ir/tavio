import { inArray, sql } from 'drizzle-orm';
import { companies } from '@/core/db/schema';
import type { Db } from '@/core/db/types';

/**
 * Best-effort removal of test companies and the tenant rows they own, for integration tests only.
 * Every table with a company_id column is cleared. A table blocked by a foreign key is retried in a
 * later pass, after the tables that reference it are gone. Never throws: rows that cannot be removed
 * (for example audit rows) keep random ids and do not affect other tests.
 */
export async function deleteTestCompanies(db: Db, companyIds: string[]): Promise<void> {
  if (companyIds.length === 0) return;
  const idList = sql.join(companyIds.map((id) => sql`${id}`), sql`, `);

  let pending: string[] = [];
  try {
    const result = (await db.execute(sql`
      select table_name from information_schema.columns
      where table_schema = 'public' and column_name = 'company_id' and table_name <> 'companies'
    `)) as unknown as { rows: { table_name: string }[] };
    pending = result.rows.map((r) => r.table_name);
  } catch {
    return;
  }

  for (let pass = 0; pass < 8 && pending.length > 0; pass += 1) {
    const blocked: string[] = [];
    for (const table of pending) {
      try {
        await db.execute(sql`delete from ${sql.identifier(table)} where company_id in (${idList})`);
      } catch {
        blocked.push(table);
      }
    }
    pending = blocked;
  }

  try {
    await db.delete(companies).where(inArray(companies.id, companyIds));
  } catch {
    // Left behind, see above.
  }
}
