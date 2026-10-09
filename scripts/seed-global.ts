// Seeds global reference data (units of measure, currencies, SaaS plans). Idempotent: uoms and currencies
// do nothing on conflict, plans upsert on code.
// Run with: pnpm db:seed   (reads DATABASE_URL via loadDevEnv; never prints it).
import { sql } from 'drizzle-orm';
import { getDb } from '../src/core/db/client';
import { loadDevEnv } from '../src/core/env/load-dev-env';
import { CURRENCY_SEED } from '../src/modules/l10n_dz/data';
import { currencies } from '../src/modules/l10n_dz/schema';
import { UOM_SEED, uoms } from '../src/modules/products/schema';
import { SAAS_PLAN_SEED } from '../src/modules/subscriptions/plans';
import { saasPlans } from '../src/modules/subscriptions/schema';

loadDevEnv();

async function main(): Promise<void> {
  const db = getDb();

  const uomRows = await db
    .insert(uoms)
    .values([...UOM_SEED])
    .onConflictDoNothing({ target: uoms.code })
    .returning({ id: uoms.id });

  const currencyRows = await db
    .insert(currencies)
    .values(CURRENCY_SEED.map((c) => ({ ...c, active: true })))
    .onConflictDoNothing({ target: currencies.code })
    .returning({ id: currencies.id });

  // Plans are upserted on code so price or module changes in plans.ts reach the database.
  const planRows = await db
    .insert(saasPlans)
    .values(
      SAAS_PLAN_SEED.map((p) => ({
        code: p.code,
        name: p.name,
        pricePerUserCents: p.pricePerUserCents,
        maxUsers: p.maxUsers,
        modules: [...p.modules],
      })),
    )
    .onConflictDoUpdate({
      target: saasPlans.code,
      set: {
        name: sql`excluded.name`,
        pricePerUserCents: sql`excluded.price_per_user_cents`,
        maxUsers: sql`excluded.max_users`,
        modules: sql`excluded.modules`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: saasPlans.id });

  console.log(
    JSON.stringify({
      uoms: { seed: UOM_SEED.length, inserted: uomRows.length },
      currencies: { seed: CURRENCY_SEED.length, inserted: currencyRows.length },
      saasPlans: { seed: SAAS_PLAN_SEED.length, upserted: planRows.length },
    }),
  );
}

main()
  .catch((e: unknown) => {
    console.error('db:seed failed', e instanceof Error ? e.name : 'unknown');
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
