import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { NAV_LINKS, localeHref } from '../content/nav';
import { RevoraLogo } from './brand/RevoraLogo';
import { LocaleSwitcher } from './LocaleSwitcher';
import { SessionCtas, SessionMobileMenu } from './SessionCtas';

/**
 * Floating header: a white rounded bar that sits on the cream background, detached from the top edge.
 * One line of links from the xl breakpoint; below it, the links move into the Sheet menu.
 * Prerendered: the session check ("Open app" vs log-in and sign-up) runs client-side in SessionCtas.
 */
export async function SiteHeader({ locale }: { locale: string }) {
  const t = await getTranslations('site');
  const links = NAV_LINKS.map((l) => ({ label: t(`nav.${l.key}`), href: localeHref(locale, l.href) }));
  const loginHref = localeHref(locale, '/login');
  const auditHref = localeHref(locale, '/contact?type=audit');
  const appHref = localeHref(locale, '/dashboard');

  return (
    <header className="sticky top-3 z-40 px-4 pt-3">
      <div className="s-navbar mx-auto flex max-w-5xl items-center gap-3 rounded-full py-2 ps-3 pe-2">
        <Link href={`/${locale}`} aria-label={t('brand.name')} className="flex shrink-0 items-center">
          <RevoraLogo className="w-[120px]" />
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
          <SessionCtas
            loginHref={loginHref}
            loginLabel={t('nav.login')}
            auditHref={auditHref}
            auditLabel={t('nav.requestAudit')}
            appHref={appHref}
            appLabel={t('nav.openApp')}
          />
        </div>

        <div className="ms-auto xl:hidden">
          <SessionMobileMenu
            links={links}
            loginHref={loginHref}
            loginLabel={t('nav.login')}
            startHref={auditHref}
            startLabel={t('nav.requestAudit')}
            appHref={appHref}
            appLabel={t('nav.openApp')}
            labels={{ open: t('nav.openMenu'), title: t('nav.menuTitle'), description: t('brand.tagline') }}
          />
        </div>
      </div>
    </header>
  );
}
