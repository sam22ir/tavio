import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { FOOTER_COLUMNS, localeHref } from '../content/nav';
import { LocaleSwitcher } from './LocaleSwitcher';
import { RevoraLogo } from './brand/RevoraLogo';

/**
 * Navy Revora footer (#071D4A) with the white logo, the tagline, link columns and the Algiers location.
 * Mobile: 2 columns. Desktop: brand block plus 5 link columns.
 */
export async function SiteFooter({ locale }: { locale: string }) {
  const t = await getTranslations('site');
  const whatsapp = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP?.replace(/\D/g, '');
  const year = new Date().getFullYear();

  return (
    <footer className="s-dark mt-16 px-4 pb-8 pt-16 md:mt-24 md:pt-20">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid w-full grid-cols-2 gap-10 md:grid-cols-6">
          <div className="col-span-2 flex flex-col gap-4">
            <RevoraLogo variant="full" tone="white" className="w-[150px]" />
            <p className="text-lg font-semibold tracking-tight">{t('brand.tagline')}</p>
            <p className="text-[15px] text-[color:var(--s-navy-ink)]/70">{t('footer.location')}</p>
            <LocaleSwitcher />
            {whatsapp ? (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[15px] font-medium text-[color:var(--s-highlight)] underline-offset-4 hover:underline"
              >
                {t('footer.whatsapp')}
              </a>
            ) : null}
          </div>
          {FOOTER_COLUMNS.map((col) => (
            <nav key={col.titleKey} aria-label={t(`footer.${col.titleKey}`)} className="flex flex-col gap-3 text-[15px]">
              <p className="font-semibold text-white">{t(`footer.${col.titleKey}`)}</p>
              {col.links.map((link) => (
                <Link key={link.href} href={localeHref(locale, link.href)} className="text-[color:var(--s-navy-ink)]/70 transition-colors hover:text-white">
                  {t(`footer.links.${link.key}`)}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <p className="mt-12 w-full border-t border-[rgba(234,240,255,0.14)] pt-6 text-xs text-[color:var(--s-navy-ink)]/60">
          © {year} {t('brand.name')}. {t('footer.rights')}
        </p>
      </div>
    </footer>
  );
}
