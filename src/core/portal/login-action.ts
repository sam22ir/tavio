'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { routing } from '@/i18n/routing';
import { requestPortalLogin } from './login';
import { readPortalBaseUrl } from './env';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LoginForm = z.object({
  locale: z.enum(routing.locales),
  companyId: z.string().regex(UUID_RE),
  identifier: z.string().trim().min(3).max(200),
});

// Only the address Cloudflare sets is trusted. Without it (local dev) every request shares one 'unknown' bucket.
function clientIp(h: Headers): string | null {
  return h.get('cf-connecting-ip')?.trim() || null;
}

/**
 * Public form action. Always redirects to the same "if an account exists" message, whatever the outcome.
 * Redirects to the company-less error page only when the link itself is incomplete.
 */
export async function requestPortalLoginAction(formData: FormData): Promise<void> {
  const parsed = LoginForm.safeParse({
    locale: formData.get('locale'),
    companyId: formData.get('c'),
    identifier: formData.get('identifier'),
  });
  if (!parsed.success) {
    const locale = routing.locales.includes(formData.get('locale') as never) ? String(formData.get('locale')) : routing.defaultLocale;
    redirect(`/${locale}/portal/login?e=invalid`);
  }
  const { locale, companyId, identifier } = parsed.data;
  const baseUrl = readPortalBaseUrl();
  if (baseUrl) {
    await requestPortalLogin({ companyId, identifier, ip: clientIp(await headers()), locale, baseUrl });
  }
  redirect(`/${locale}/portal/login?c=${companyId}&sent=1`);
}
