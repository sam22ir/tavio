import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { FOOTER_COLUMNS, localeHref } from '../content/nav';
import { LocaleSwitcher } from './LocaleSwitcher';

/**
 * Marketing footer: link columns, WhatsApp contact (hidden when
 * NEXT_PUBLIC_CONTACT_WHATSAPP is unset), language switcher and rights line.
 * Mobile: 2 columns. Desktop: 4 columns plus the brand block.
 */
export async function SiteFooter({ locale }: { locale: string }) {
  const t = await getTranslations('site');
  const whatsapp = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP?.replace(/\D/g, '');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-muted/30 px-4 py-14">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-10 md:grid-cols-6">
        <div className="col-span-2 flex flex-col gap-4">
          <p className="text-lg font-semibold tracking-tight">{t('brand.name')}</p>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{t('footer.tagline')}</p>
          <LocaleSwitcher />
          {whatsapp ? (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              {t('footer.whatsapp')}
            </a>
          ) : null}
        </div>
        {FOOTER_COLUMNS.map((col) => (
          <nav key={col.titleKey} aria-label={t(`footer.${col.titleKey}`)} className="flex flex-col gap-3 text-sm">
            <p className="font-semibold">{t(`footer.${col.titleKey}`)}</p>
            {col.links.map((link) => (
              <Link key={link.href} href={localeHref(locale, link.href)} className="text-muted-foreground hover:text-foreground">
                {t(`footer.links.${link.key}`)}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <p className="mx-auto mt-12 w-full max-w-6xl text-xs text-muted-foreground">
        © {year} {t('brand.name')}. {t('footer.rights')}
      </p>
    </footer>
  );
}
