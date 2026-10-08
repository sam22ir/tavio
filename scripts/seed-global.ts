// Seeds global reference data (units of measure, currencies). Idempotent: on conflict do nothing.
// Run with: pnpm db:seed   (reads DATABASE_URL via loadDevEnv; never prints it).
import { getDb } from '../src/core/db/client';
import { loadDevEnv } from '../src/core/env/load-dev-env';
import { CURRENCY_SEED } from '../src/modules/l10n_dz/data';
import { currencies } from '../src/modules/l10n_dz/schema';
import { UOM_SEED, uoms } from '../src/modules/products/schema';

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

  console.log(
    JSON.stringify({
      uoms: { seed: UOM_SEED.length, inserted: uomRows.length },
      currencies: { seed: CURRENCY_SEED.length, inserted: currencyRows.length },
    }),
  );
}

main()
  .catch((e: unknown) => {
    console.error('db:seed failed', e instanceof Error ? e.name : 'unknown');
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
