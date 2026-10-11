import { NextResponse, type NextRequest } from 'next/server';
import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { readPortalSecret } from '@/core/portal/env';
import { consumePortalToken } from '@/core/portal/consume';
import { portalTargetPath } from '@/core/portal/tokens';
import { PORTAL_COOKIE, SESSION_TTL_MS, signPortalSession } from '@/core/portal/session';
import { portalCookieOptions } from '@/core/portal/session-cookie';

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

  // A document link opens only its own document, and its session never outlives the link.
  const linked = consumed.value;
  const scope = linked.purpose === 'document' ? linked.target : null;
  const exp = Math.min(now.getTime() + SESSION_TTL_MS, linked.purpose === 'document' ? linked.expiresAt.getTime() : Number.MAX_SAFE_INTEGER);
  const value = signPortalSession(
    { companyId: linked.companyId, partnerId: linked.partnerId, tokenId: linked.tokenId, scope, exp },
    secret,
  );
  const path = scope ? portalTargetPath(scope) : '/portal';
  const maxAge = Math.max(1, Math.floor((exp - now.getTime()) / 1000));
  const res = NextResponse.redirect(new URL(`/${locale}${path}`, request.url));
  res.cookies.set(PORTAL_COOKIE, value, portalCookieOptions(locale, maxAge));
  res.headers.set('Referrer-Policy', 'no-referrer');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
