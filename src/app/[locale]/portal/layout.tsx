import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { routing } from '@/i18n/routing';
import { currentPortalSession } from '@/core/portal/session-cookie';
import { isFullSession } from '@/core/portal/session';
import { portalCtx } from '@/core/portal/context';
import { companyIdentityOf } from '@/modules/invoicing/queries';

// Every portal page reads the portal session cookie; never prerender at build time.
export const dynamic = 'force-dynamic';

// Portal shell. Separate from the staff shell: no staff menus and no staff session.
// Renders the company header only when a valid portal session exists. Pages enforce access themselves.
export default async function PortalLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('portal');

  const session = await currentPortalSession();
  const company = session
    ? await portalCtx(session, locale as 'fr' | 'ar' | 'en', async ({ ctx }) => companyIdentityOf(ctx)).catch(() => null)
    : null;

  return (
    <div className="flex min-h-dvh flex-col bg-[#F4F1EA] text-stone-900">
      <header className="border-b border-stone-200 bg-white print:hidden">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {company?.logoUrl ? (
              <Image src={company.logoUrl} alt="" width={36} height={36} unoptimized className="size-9 rounded object-contain" />
            ) : null}
            <span className="truncate font-semibold">{company?.legalName ?? t('brand')}</span>
          </div>
          {session ? (
            <form action={`/${locale}/portal/logout`} method="post">
              <button type="submit" className="min-h-11 min-w-11 rounded-lg px-3 text-sm text-stone-700 hover:bg-stone-100">
                {t('nav.logout')}
              </button>
            </form>
          ) : null}
        </div>
        {session && isFullSession(session) ? (
          <nav aria-label={t('nav.label')} className="mx-auto flex w-full max-w-3xl gap-1 overflow-x-auto px-2 pb-2 text-sm">
            <Link href={`/${locale}/portal`} className="min-h-11 shrink-0 rounded-lg px-3 py-2.5 hover:bg-stone-100">{t('nav.home')}</Link>
            <Link href={`/${locale}/portal/invoices`} className="min-h-11 shrink-0 rounded-lg px-3 py-2.5 hover:bg-stone-100">{t('nav.invoices')}</Link>
            <Link href={`/${locale}/portal/contracts`} className="min-h-11 shrink-0 rounded-lg px-3 py-2.5 hover:bg-stone-100">{t('nav.contracts')}</Link>
            <Link href={`/${locale}/portal/receipts`} className="min-h-11 shrink-0 rounded-lg px-3 py-2.5 hover:bg-stone-100">{t('nav.receipts')}</Link>
          </nav>
        ) : null}
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
