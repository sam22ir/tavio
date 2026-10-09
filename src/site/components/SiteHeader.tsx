import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/ui/primitives/button';
import { NAV_LINKS, localeHref } from '../content/nav';
import { LocaleSwitcher } from './LocaleSwitcher';
import { MobileMenu } from './MobileMenu';

/**
 * Sticky marketing header, 64px tall. One line of links from the xl breakpoint;
 * below it, the links move into the Sheet menu.
 * Signed-in visitors see "Open app" instead of log-in and sign-up.
 */
export async function SiteHeader({ locale, signedIn }: { locale: string; signedIn: boolean }) {
  const t = await getTranslations('site');
  const links = NAV_LINKS.map((l) => ({ label: t(`nav.${l.key}`), href: localeHref(locale, l.href) }));
  const loginHref = localeHref(locale, '/login');
  const startHref = localeHref(locale, '/signup');
  const appHref = localeHref(locale, '/dashboard');

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href={`/${locale}`} className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span aria-hidden className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            T
          </span>
          {t('brand.name')}
        </Link>

        <nav aria-label={t('nav.mainLabel')} className="hidden items-center gap-5 xl:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto hidden items-center gap-3 xl:flex">
          <LocaleSwitcher />
          {signedIn ? (
            <Button asChild size="sm">
              <Link href={appHref}>{t('nav.openApp')}</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href={loginHref}>{t('nav.login')}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href={startHref}>{t('nav.startFree')}</Link>
              </Button>
            </>
          )}
        </div>

        <div className="ms-auto xl:hidden">
          <MobileMenu
            links={links}
            loginHref={loginHref}
            loginLabel={t('nav.login')}
            startHref={startHref}
            startLabel={t('nav.startFree')}
            appHref={signedIn ? appHref : undefined}
            appLabel={t('nav.openApp')}
            labels={{ open: t('nav.openMenu'), title: t('nav.menuTitle'), description: t('brand.tagline') }}
          />
        </div>
      </div>
    </header>
  );
}
