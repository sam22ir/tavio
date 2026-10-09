import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { NAV_LINKS, localeHref } from '../content/nav';
import { CtaLink } from './CtaLink';
import { LocaleSwitcher } from './LocaleSwitcher';
import { MobileMenu } from './MobileMenu';

/**
 * Floating header: a white rounded bar that sits on the cream background, detached from the top edge.
 * One line of links from the xl breakpoint; below it, the links move into the Sheet menu.
 * Signed-in visitors see "Open app" instead of log-in and sign-up.
 */
export async function SiteHeader({ locale, signedIn }: { locale: string; signedIn: boolean }) {
  const t = await getTranslations('site');
  const links = NAV_LINKS.map((l) => ({ label: t(`nav.${l.key}`), href: localeHref(locale, l.href) }));
  const loginHref = localeHref(locale, '/login');
  const startHref = localeHref(locale, '/signup');
  const appHref = localeHref(locale, '/dashboard');

  return (
    <header className="sticky top-3 z-40 px-4 pt-3">
      <div className="s-navbar mx-auto flex max-w-5xl items-center gap-3 rounded-full py-2 ps-3 pe-2">
        <Link href={`/${locale}`} className="flex items-center gap-2.5 whitespace-nowrap text-[17px] font-bold tracking-tight">
          <span className="s-mark" aria-hidden>
            T
          </span>
          {t('brand.name')}
        </Link>

        <nav aria-label={t('nav.mainLabel')} className="ms-4 hidden items-center gap-4 xl:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="s-navlink whitespace-nowrap text-[15px]">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto hidden items-center gap-2 whitespace-nowrap xl:flex">
          <LocaleSwitcher />
          {signedIn ? (
            <CtaLink href={appHref} label={t('nav.openApp')} />
          ) : (
            <>
              <CtaLink href={loginHref} label={t('nav.login')} variant="light" arrow={false} />
              <CtaLink href={startHref} label={t('nav.startFree')} />
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
