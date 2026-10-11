import { NextResponse, type NextRequest } from 'next/server';
import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { PORTAL_COOKIE } from '@/core/portal/session';
import { portalCookieOptions } from '@/core/portal/session-cookie';

// Clears the portal cookie only. Staff sessions are not touched.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
): Promise<NextResponse> {
  const { locale } = await params;
  const safe = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const res = NextResponse.redirect(new URL(`/${safe}/portal/login`, request.url), { status: 303 });
  res.cookies.set(PORTAL_COOKIE, '', portalCookieOptions(safe, 0));
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
