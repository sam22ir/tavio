import { inArray, sql } from 'drizzle-orm';
import { companies } from '@/core/db/schema';
import type { Db } from '@/core/db/types';

/**
 * Best-effort removal of test companies and the tenant rows they own, for integration tests only.
 * Every table with a company_id column is cleared. A table blocked by a foreign key is retried in a
 * later pass, after the tables that reference it are gone. Never throws: rows that cannot be removed
 * (for example audit rows) keep random ids and do not affect other tests.
 */
/**
 * Tenant tables that reference companies, or each other, cleared first in this order (children before
 * parents). Tables not listed here are still cleared by the generic pass below.
 */
const FK_ORDERED_TABLES = [
  'bank_statement_matches',
  'bank_statement_lines',
  'bank_statements',
  'message_opt_outs',
  'outbound_messages',
  'message_templates',
  'message_settings',
  'portal_access_tokens',
  'portal_login_requests',
  'g50_declarations',
  'l10n_dz_stamp_tiers',
  'l10n_dz_settings',
  'accounting_settings',
  'contract_settings',
  'fiscal_years',
];

export async function deleteTestCompanies(db: Db, companyIds: string[]): Promise<void> {
  if (companyIds.length === 0) return;
  const idList = sql.join(companyIds.map((id) => sql`${id}`), sql`, `);

  let pending: string[] = [];
  try {
    const result = (await db.execute(sql`
      select table_name from information_schema.columns
      where table_schema = 'public' and column_name = 'company_id' and table_name <> 'companies'
    `)) as unknown as { rows: { table_name: string }[] };
    const found = new Set(result.rows.map((r) => r.table_name));
    const ordered = FK_ORDERED_TABLES.filter((t) => found.has(t));
    for (const table of ordered) {
      try {
        await db.execute(sql`delete from ${sql.identifier(table)} where company_id in (${idList})`);
      } catch {
        // Retried by the generic passes below.
      }
    }
    pending = [...found].filter((t) => !ordered.includes(t));
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
