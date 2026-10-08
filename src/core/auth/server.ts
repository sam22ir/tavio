import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb } from '@/core/db/client';
import { accounts, sessions, users, verifications } from '@/core/db/schema/auth';

function createAuth() {
  return betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(getDb(), {
    provider: 'pg',
    schema: { users, sessions, accounts, verifications },
  }),
  user: { modelName: 'users' },
  session: { modelName: 'sessions' },
  account: { modelName: 'accounts' },
  verification: { modelName: 'verifications' },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  advanced: {
    database: {
      generateId: 'uuid',
    },
  },
  });
}

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

/** Lazily creates the auth instance so importing this module never opens a DB connection (e.g. during build). */
export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}
