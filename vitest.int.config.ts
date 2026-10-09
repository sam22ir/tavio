import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { loadDevEnv } from './src/core/env/load-dev-env';

loadDevEnv();

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['src/**/*.int.test.ts'],
    // The dev database is remote, so a single transaction with several round trips can pass 5 seconds.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
