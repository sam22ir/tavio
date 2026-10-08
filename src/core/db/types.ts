import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
export type Db = NodePgDatabase;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
