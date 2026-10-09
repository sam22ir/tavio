import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Clock, Handshake, Mail, MessageCircle, type LucideIcon } from 'lucide-react';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { buildMetadata } from '@/site/seo';
import { PageHero, Section } from '@/site/components';
import { ContactForm } from '@/site/contact/ContactForm';
import { CONTACT_TYPES, type ContactType } from '@/site/contact/schema';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'site_company.contact.meta' });
  return buildMetadata({ locale: locale as Locale, path: '/contact', title: t('title'), description: t('description') });
}

/** One contact option card: icon tile, title, body and an optional action. */
function ChannelCard({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="s-panel flex min-w-0 flex-col gap-4 p-6 md:p-7">
      <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--s-accent-soft)] text-[color:var(--s-accent)]">
        <Icon size={20} strokeWidth={1.75} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        <h3 className="break-words text-lg font-semibold tracking-tight">{title}</h3>
        <p className="break-words leading-relaxed text-[color:var(--s-muted)]">{body}</p>
      </div>
      {children}
    </div>
  );
}

export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('site_company.contact');

  // `?type=audit|demo|services|other` preselects the request type. Anything else falls back to "other".
  const { type } = await searchParams;
  const requested = Array.isArray(type) ? type[0] : type;
  const defaultType: ContactType = (CONTACT_TYPES as readonly string[]).includes(requested ?? '') ? (requested as ContactType) : 'other';

  // Public number for the WhatsApp button. Digits only, e.g. 213550123456. Hidden when unset.
  const whatsapp = (process.env.NEXT_PUBLIC_CONTACT_WHATSAPP ?? '').replace(/\D/g, '');
  const contactEmail = process.env.CONTACT_EMAIL || process.env.EMAIL_FROM || '';

  return (
    <>
      <PageHero eyebrow={t('eyebrow')} title={t('title')} subtitle={t('body')} />

      <Section className="pt-12 md:pt-16">
        <div className="grid min-w-0 items-start gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-16">
          <div className="flex min-w-0 flex-col gap-10">
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
              {whatsapp ? (
                <ChannelCard icon={MessageCircle} title={t('whatsapp.title')} body={t('whatsapp.body')}>
                  <a
                    href={`https://wa.me/${whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="s-btn s-btn-light w-fit self-start rounded-full px-5 py-2.5 text-sm font-medium"
                  >
                    {t('whatsapp.cta')}
                  </a>
                </ChannelCard>
              ) : null}

              {contactEmail ? (
                <ChannelCard icon={Mail} title={t('email')} body={t('emailBody')}>
                  <a href={`mailto:${contactEmail}`} className="w-fit break-all text-sm font-medium text-[color:var(--s-accent)] underline-offset-4 hover:underline" dir="ltr">
                    {contactEmail}
                  </a>
                </ChannelCard>
              ) : null}

              <ChannelCard icon={Handshake} title={t('pilot.title')} body={t('pilot.body')} />
              <ChannelCard icon={Clock} title={t('response.title')} body={t('response.body')} />
            </div>
          </div>

          <ContactForm defaultType={defaultType} />
        </div>
      </Section>
    </>
  );
}
