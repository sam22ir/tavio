import { NextResponse, type NextRequest } from 'next/server';
import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { readPortalSecret } from '@/core/portal/env';
import { consumePortalToken } from '@/core/portal/consume';
import { portalTargetPath } from '@/core/portal/tokens';
import { PORTAL_COOKIE, SESSION_TTL_MS, signPortalSession } from '@/core/portal/session';
import { PORTAL_SESSION_MAX_AGE_SECONDS, portalCookieOptions } from '@/core/portal/session-cookie';

// Opens a portal link: verifies it, sets the portal session cookie, then redirects.
// The token sits in the path, so the response also asks browsers not to send it as a referrer.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string; token: string }> },
): Promise<NextResponse> {
  const { locale, token } = await params;
  if (!hasLocale(routing.locales, locale)) return new NextResponse(null, { status: 404 });

  const fail = (reason: string): NextResponse => {
    const res = NextResponse.redirect(new URL(`/${locale}/portal/login?e=${reason}`, request.url));
    res.headers.set('Referrer-Policy', 'no-referrer');
    res.headers.set('Cache-Control', 'no-store');
    return res;
  };

  const secret = readPortalSecret();
  if (!secret) return fail('config');

  const now = new Date();
  const consumed = await consumePortalToken(token, locale, now);
  if (!consumed.ok) return fail(consumed.error.details?.reason === 'expired' ? 'expired' : consumed.error.details?.reason === 'used' ? 'used' : 'link');

  const value = signPortalSession(
    { companyId: consumed.value.companyId, partnerId: consumed.value.partnerId, exp: now.getTime() + SESSION_TTL_MS },
    secret,
  );
  const path = consumed.value.target ? portalTargetPath(consumed.value.target) : '/portal';
  const res = NextResponse.redirect(new URL(`/${locale}${path}`, request.url));
  res.cookies.set(PORTAL_COOKIE, value, portalCookieOptions(locale, PORTAL_SESSION_MAX_AGE_SECONDS));
  res.headers.set('Referrer-Policy', 'no-referrer');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
