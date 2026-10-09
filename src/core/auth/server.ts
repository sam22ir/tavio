import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb, requestScopeKey } from '@/core/db/client';
import { accounts, sessions, users, verifications } from '@/core/db/schema/auth';
import { emailConfigured, sendEmail } from '@/core/adapters/email';
import { resetPasswordEmail, verifyEmailEmail, type EmailLocale } from './emails';

/** Origins allowed to call auth endpoints: BETTER_AUTH_URL plus comma-separated BETTER_AUTH_TRUSTED_ORIGINS. */
function readTrustedOrigins(): string[] {
  const extra = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  const self = process.env.BETTER_AUTH_URL?.trim();
  return self ? [self, ...extra] : extra;
}

const LOCALES: readonly EmailLocale[] = ['fr', 'ar', 'en'];

/** Locale from the callbackURL (e.g. /ar/reset-password) that the client passed; falls back to fr. */
function localeFromUrl(url: string): EmailLocale {
  try {
    const callback = new URL(url).searchParams.get('callbackURL');
    const segment = callback ? callback.split('/')[1] : undefined;
    if (segment && LOCALES.includes(segment as EmailLocale)) return segment as EmailLocale;
  } catch {
    // Malformed URL: use the default.
  }
  return 'fr';
}

function createAuth() {
  const trustedOrigins = readTrustedOrigins();
  return betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,
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
    sendResetPassword: async ({ user, url, token }) => {
      const locale = localeFromUrl(url);
      const link = `${new URL(url).origin}/${locale}/reset-password?token=${encodeURIComponent(token)}`;
      await sendEmail({ to: user.email, ...resetPasswordEmail({ locale, url: link }) });
    },
  },
  emailVerification: {
    sendOnSignUp: emailConfigured(),
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({ to: user.email, ...verifyEmailEmail({ locale: localeFromUrl(url), url }) });
    },
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
const perRequest = new WeakMap<object, Auth>();

/**
 * Lazily creates the auth instance so importing this module never opens a DB connection (e.g. during build).
 * On Workers the instance holds that request's DB pool, so it is cached per request, never globally.
 */
export function getAuth(): Auth {
  const key = requestScopeKey();
  if (key) {
    let auth = perRequest.get(key);
    if (!auth) {
      auth = createAuth();
      perRequest.set(key, auth);
    }
    return auth;
  }
  instance ??= createAuth();
  return instance;
}
