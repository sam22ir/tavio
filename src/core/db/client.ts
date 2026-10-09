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
  const pool = new Pool({ connectionString: hyperdrive.connectionString, max: 5 });
  // Workers closes sockets when the request ends; idle clients then emit errors we must not leak as unhandled.
  pool.on('error', () => {});
  const db = drizzle(pool);
  if (key) workerCache.set(key, db);
  return db;
}

/**
 * Key identifying the current Workers request (its ExecutionContext), or undefined outside Workers.
 * Anything holding I/O objects (DB pools, auth instances) must be cached per this key on Workers,
 * because Workers forbids reusing I/O across requests.
 */
export function requestScopeKey(): object | undefined {
  try {
    const cf = getCloudflareContext({ async: false });
    return (cf.ctx as object | undefined) ?? undefined;
  } catch {
    return undefined;
  }
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
