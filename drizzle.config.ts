import { defineConfig } from 'drizzle-kit';
import { loadDevEnv } from './src/core/env/load-dev-env';

loadDevEnv();

export default defineConfig({
  schema: ['./src/core/db/schema/index.ts', './src/modules/*/schema.ts'],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
