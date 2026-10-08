import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';

// Loads dev credentials for tests and drizzle-kit. Never print or log the file contents.
// Existing environment variables are not overridden. Does nothing if the file is missing.
export function loadDevEnv(): void {
  const file = process.env.TAVIO_ENV_FILE ?? path.join(os.homedir(), '.config', 'tavio', 'test.env');
  if (!existsSync(file)) return;
  dotenv.config({ path: file, override: false, quiet: true });
}
