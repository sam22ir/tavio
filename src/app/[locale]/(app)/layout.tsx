import { setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { loadShell } from '@/ui/shell/load-shell';
import { AppRail } from '@/ui/shell/app-rail';
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
    <div className="app-shell min-h-dvh p-3 md:p-4 print:p-0">
      <div className="mx-auto flex min-h-[calc(100dvh-1.5rem)] max-w-[1600px] gap-3 rounded-[28px] bg-surface-secondary p-3 shadow-[0_1px_2px_rgb(20_23_28/0.04),0_16px_40px_-20px_rgb(20_23_28/0.18)] md:min-h-[calc(100dvh-2rem)] md:p-4 print:block print:min-h-0 print:max-w-none print:rounded-none print:bg-transparent print:p-0 print:shadow-none">
        <AppRail apps={shell.apps} />
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <TopBar
            apps={shell.apps}
            companies={shell.companies}
            activeCompanyId={shell.active.id}
            email={shell.email}
          />
          <main className="w-full flex-1 print:p-0">{children}</main>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
