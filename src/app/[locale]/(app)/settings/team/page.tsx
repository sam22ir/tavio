import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { invitationEmailEnabled, listInvitations } from '@/core/tenancy/invitations';
import { canManageTeam, getMemberRole, listMembers } from '@/core/tenancy/members';
import { routing } from '@/i18n/routing';
import { TeamPanel } from './team-panel';

export default async function TeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('team');

  const data = await withPageCtx(async (ctx) => {
    const role = await getMemberRole(ctx.userId, ctx.companyId);
    const members = await listMembers(ctx.companyId);
    const invites = await listInvitations(ctx.userId, ctx.companyId);
    return {
      userId: ctx.userId,
      canManage: canManageTeam(role),
      members,
      invitations: invites.ok ? invites.value : [],
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted">{t('subtitle')}</p>
      </div>
      <TeamPanel
        members={data.members.map((m) => ({
          membershipId: m.membershipId,
          name: m.name,
          email: m.email,
          roleKey: m.roleKey,
          isMe: m.userId === data.userId,
        }))}
        invitations={data.invitations.map((i) => ({
          id: i.id,
          email: i.email,
          roleKey: i.roleKey,
          expiresAt: i.expiresAt.toISOString(),
          expired: i.expired,
        }))}
        canManage={data.canManage}
        emailEnabled={invitationEmailEnabled()}
      />
    </div>
  );
}
