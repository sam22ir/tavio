import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { NAV_LINKS, localeHref } from '../content/nav';
import { CtaLink } from './CtaLink';
import { LocaleSwitcher } from './LocaleSwitcher';
import { MobileMenu } from './MobileMenu';
import { RevoraLogo } from './brand/RevoraLogo';

/**
 * Floating white header bar, detached from the top edge. Revora logo on the left, nav links, then
 * "Se connecter" (white pill) and "Demander un audit" (Revora blue pill). One line from xl; below it, the Sheet menu.
 * Signed-in visitors see "Open app" instead of the two CTAs.
 */
export async function SiteHeader({ locale, signedIn }: { locale: string; signedIn: boolean }) {
  const t = await getTranslations('site');
  const links = NAV_LINKS.map((l) => ({ label: t(`nav.${l.key}`), href: localeHref(locale, l.href) }));
  const loginHref = localeHref(locale, '/login');
  const auditHref = localeHref(locale, '/contact');
  const appHref = localeHref(locale, '/dashboard');

  return (
    <header className="sticky top-3 z-40 px-4 pt-3">
      <div className="s-navbar mx-auto flex max-w-6xl items-center gap-3 rounded-full py-2 ps-4 pe-2">
        <Link href={`/${locale}`} aria-label={t('brand.name')} className="shrink-0">
          <RevoraLogo className="w-[120px]" />
        </Link>

        <nav aria-label={t('nav.mainLabel')} className="ms-6 hidden items-center gap-5 xl:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="s-navlink whitespace-nowrap text-[15px]">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto hidden items-center gap-2 whitespace-nowrap xl:flex">
          <LocaleSwitcher />
          {signedIn ? (
            <CtaLink href={appHref} label={t('nav.openApp')} variant="accent" arrow={false} />
          ) : (
            <>
              <CtaLink href={loginHref} label={t('nav.login')} variant="light" arrow={false} />
              <CtaLink href={auditHref} label={t('nav.requestAudit')} variant="accent" arrow={false} />
            </>
          )}
        </div>

        <div className="ms-auto xl:hidden">
          <MobileMenu
            links={links}
            loginHref={loginHref}
            loginLabel={t('nav.login')}
            startHref={auditHref}
            startLabel={t('nav.requestAudit')}
            appHref={signedIn ? appHref : undefined}
            appLabel={t('nav.openApp')}
            labels={{ open: t('nav.openMenu'), title: t('nav.menuTitle'), description: t('brand.tagline') }}
          />
        </div>
      </div>
    </header>
  );
}
