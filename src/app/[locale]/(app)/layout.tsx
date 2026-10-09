import { setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { loadShell } from '@/ui/shell/load-shell';
import { TopBar } from '@/ui/shell/top-bar';
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

  return (
    <div className="app-shell flex min-h-dvh flex-col">
      <TopBar
        apps={shell.apps}
        companies={shell.companies}
        activeCompanyId={shell.active.id}
        email={shell.email}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>
      <Toaster />
    </div>
  );
}
