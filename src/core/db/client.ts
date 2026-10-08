import { getCloudflareContext } from '@opennextjs/cloudflare';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Db } from './types';

let cached: Db | undefined;
// One Hyperdrive-backed Db per Cloudflare ExecutionContext (i.e. per request).
const workerCache = new WeakMap<object, Db>();

interface HyperdriveBinding { connectionString: string }

// On Cloudflare, returns a per-request Db bound to the Hyperdrive connection string.
// Returns undefined when not running on Workers or when HYPERDRIVE is not bound.
function getHyperdriveDb(): Db | undefined {
  let cf: ReturnType<typeof getCloudflareContext>;
  try {
    cf = getCloudflareContext({ async: false });
  } catch {
    return undefined;
  }
  const hyperdrive = (cf.env as { HYPERDRIVE?: HyperdriveBinding }).HYPERDRIVE;
  if (!hyperdrive) return undefined;
  const key = cf.ctx as object | undefined;
  const existing = key ? workerCache.get(key) : undefined;
  if (existing) return existing;
  const db = drizzle(new Pool({ connectionString: hyperdrive.connectionString, max: 5 }));
  if (key) workerCache.set(key, db);
  return db;
}

// On Cloudflare (Hyperdrive) uses a per-request pool; otherwise lazily creates one Node pool from DATABASE_URL.
export function getDb(): Db {
  const workerDb = getHyperdriveDb();
  if (workerDb) return workerDb;
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  cached = drizzle(new Pool({ connectionString: url }));
  return cached;
}
