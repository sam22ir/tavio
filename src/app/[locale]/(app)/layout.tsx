import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { loadShell } from '@/ui/shell/load-shell';
import { MobileNav } from '@/ui/shell/mobile-nav';
import { ShellNav } from '@/ui/shell/shell-nav';
import { Toaster } from '@/ui/primitives/sonner';

// Every page here reads the session; never prerender at build time.
export const dynamic = 'force-dynamic';

// Module pages read the session and tenant data, so they block navigation by design.

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const shell = await loadShell(locale as Locale);
  const t = await getTranslations('shell');

  const items = [
    { href: `/${locale}/dashboard`, label: t('nav.dashboard') },
    ...shell.moduleItems,
    { href: `/${locale}/settings`, label: t('nav.settings') },
  ];
  const navProps = {
    items,
    companies: shell.companies,
    activeCompanyId: shell.active.id,
    email: shell.email,
  };

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-e bg-background md:block">
        <ShellNav {...navProps} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center border-b p-2 md:hidden">
          <MobileNav {...navProps} appName={t('appName')} />
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
