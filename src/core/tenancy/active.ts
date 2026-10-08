import { cookies } from 'next/headers';

// Active company is stored in the httpOnly cookie `tavio_company` (one year).
const COOKIE_NAME = 'tavio_company';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getActiveCompanyId(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  return value && UUID_RE.test(value) ? value : null;
}

export async function setActiveCompanyId(companyId: string): Promise<void> {
  if (!UUID_RE.test(companyId)) throw new Error('companyId must be a UUID');
  const store = await cookies();
  store.set(COOKIE_NAME, companyId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  });
}
