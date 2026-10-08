import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Db } from './types';

let cached: Db | undefined;

// Lazily creates one pg Pool from DATABASE_URL and caches the drizzle instance at module level.
export function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  cached = drizzle(new Pool({ connectionString: url }));
  return cached;
}
