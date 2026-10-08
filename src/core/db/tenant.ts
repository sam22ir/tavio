import { sql } from 'drizzle-orm';
import type { Ctx, Locale } from '../ctx';
import { getDb } from './client';
import type { Db } from './types';

export interface TenantArgs {
  userId: string;
  companyId: string;
  perms: ReadonlySet<string>;
  locale: Locale;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(name: string, value: string): void {
  if (!UUID_RE.test(value)) throw new Error(`${name} must be a UUID`);
}

// Runs fn inside one transaction with the tenant set for RLS. Throws roll the transaction back.
export async function withTenant<T>(
  args: TenantArgs,
  fn: (ctx: Ctx) => Promise<T>,
  db: Db = getDb(),
): Promise<T> {
  assertUuid('companyId', args.companyId);
  assertUuid('userId', args.userId);
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.company_id', ${args.companyId}, true), set_config('app.user_id', ${args.userId}, true)`,
    );
    return fn({ ...args, tx });
  });
}
