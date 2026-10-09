import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { FOOTER_COLUMNS, localeHref } from '../content/nav';
import { LocaleSwitcher } from './LocaleSwitcher';
import { RevoraLogo } from './brand/RevoraLogo';

/**
 * Marketing footer: a white panel on cream with link columns, WhatsApp contact (hidden when
 * NEXT_PUBLIC_CONTACT_WHATSAPP is unset), language switcher and rights line.
 * Mobile: 2 columns. Desktop: 6-column grid with the brand block.
 */
export async function SiteFooter({ locale }: { locale: string }) {
  const t = await getTranslations('site');
  const whatsapp = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP?.replace(/\D/g, '');
  const year = new Date().getFullYear();

  return (
    <footer className="px-4 pb-6 pt-16 md:pt-24">
      <div className="s-panel mx-auto w-full max-w-6xl px-6 py-12 md:px-12">
        <div className="grid w-full grid-cols-2 gap-10 md:grid-cols-6">
          <div className="col-span-2 flex flex-col gap-4">
            <RevoraLogo className="w-[140px]" />
            <p className="max-w-xs text-[15px] leading-relaxed text-[color:var(--s-muted)]">{t('footer.tagline')}</p>
            <LocaleSwitcher />
            {whatsapp ? (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[15px] font-medium text-[color:var(--s-accent)] underline-offset-4 hover:underline"
              >
                {t('footer.whatsapp')}
              </a>
            ) : null}
          </div>
          {FOOTER_COLUMNS.map((col) => (
            <nav key={col.titleKey} aria-label={t(`footer.${col.titleKey}`)} className="flex flex-col gap-3 text-[15px]">
              <p className="font-semibold">{t(`footer.${col.titleKey}`)}</p>
              {col.links.map((link) => (
                <Link key={link.href} href={localeHref(locale, link.href)} className="text-[color:var(--s-muted)] transition-colors hover:text-[color:var(--s-ink)]">
                  {t(`footer.links.${link.key}`)}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <p className="mt-12 w-full border-t border-[rgba(15,26,23,0.08)] pt-6 text-xs text-[color:var(--s-muted)]">
          © {year} {t('brand.name')}. {t('footer.rights')}
        </p>
      </div>
    </footer>
  );
}
