import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { getSession } from '@/core/auth/session';
import { getInvitationPreview } from '@/core/tenancy/invitations';
import { routing } from '@/i18n/routing';
import { AcceptButton } from './accept-button';

export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('team');

  const preview = await getInvitationPreview(token);
  if (!preview.ok) {
    return <Shell><p className="text-sm text-muted-foreground">{t('invite_page.not_found')}</p></Shell>;
  }
  const invite = preview.value;
  if (invite.state !== 'open') {
    return <Shell><p className="text-sm text-muted-foreground">{t(`invite_page.state_${invite.state}`)}</p></Shell>;
  }

  const details = (
    <p className="text-sm">
      {t('invite_page.details', { company: invite.companyName, role: t(`roles.${invite.roleKey}`) })}
    </p>
  );

  const session = await getSession();
  if (!session) {
    const next = encodeURIComponent(`/${locale}/invite/${token}`);
    return (
      <Shell>
        {details}
        <p className="text-sm text-muted-foreground">{t('invite_page.signed_out')}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/${locale}/signup?next=${next}&email=${encodeURIComponent(invite.email)}`}
            className="inline-flex flex-1 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t('invite_page.signup')}
          </Link>
          <Link
            href={`/${locale}/login?next=${next}&email=${encodeURIComponent(invite.email)}`}
            className="inline-flex flex-1 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-default"
          >
            {t('invite_page.login')}
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {details}
      <p className="text-sm text-muted-foreground">
        {t('invite_page.signed_in_as', { email: session.email })}
      </p>
      <AcceptButton token={token} inviteEmail={invite.email} sessionEmail={session.email} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 md:p-6">{children}</main>;
}
