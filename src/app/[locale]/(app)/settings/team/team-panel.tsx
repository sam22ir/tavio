'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/primitives/table';
import {
  changeRoleAction,
  inviteMemberAction,
  removeMemberAction,
  revokeInvitationAction,
  type TeamActionResult,
} from './actions';

export interface TeamMemberView {
  membershipId: string;
  name: string;
  email: string;
  roleKey: string;
  isMe: boolean;
}

export interface TeamInvitationView {
  id: string;
  email: string;
  roleKey: string;
  expiresAt: string;
}

const ROLE_KEYS = ['owner', 'admin', 'manager', 'staff'] as const;
const INVITE_ROLE_KEYS = ['admin', 'manager', 'staff'] as const;

interface InviteResult {
  url: string;
  emailSent: boolean;
}

export function TeamPanel({
  members,
  invitations,
  canManage,
  emailEnabled,
}: {
  members: TeamMemberView[];
  invitations: TeamInvitationView[];
  canManage: boolean;
  emailEnabled: boolean;
}) {
  const t = useTranslations('team');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function run(action: () => Promise<TeamActionResult<unknown>>): Promise<TeamActionResult<unknown>> {
    setPending(true);
    setError(null);
    try {
      const result = await action();
      if (!result.ok) setError(t(result.key));
      return result;
    } catch {
      setError(t('errors.generic'));
      return { ok: false, key: 'errors.generic' };
    } finally {
      setPending(false);
    }
  }

  async function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    setCopied(false);
    const result = await run(() =>
      inviteMemberAction({
        email: String(fd.get('email') ?? ''),
        roleKey: String(fd.get('roleKey') ?? 'staff') as (typeof INVITE_ROLE_KEYS)[number],
      }),
    );
    if (result.ok) {
      setInvite(result.value as InviteResult);
      form.reset();
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError(t('errors.generic'));
    }
  }

  const whatsappHref = invite
    ? `https://wa.me/?text=${encodeURIComponent(`${t('invite.whatsapp_message')} ${invite.url}`)}`
    : '';

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="font-medium">{t('members.title')}</h2>
        {members.length === 0 ? <p className="text-sm text-muted-foreground">{t('members.empty')}</p> : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('members.name')}</TableHead>
              <TableHead>{t('members.email')}</TableHead>
              <TableHead>{t('members.role')}</TableHead>
              <TableHead>{t('members.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.membershipId}>
                <TableCell>
                  {m.name}
                  {m.isMe ? <span className="ms-2 text-xs text-muted-foreground">({t('members.you')})</span> : null}
                </TableCell>
                <TableCell dir="ltr" className="text-start">{m.email}</TableCell>
                <TableCell>
                  <select
                    aria-label={t('members.role')}
                    className="rounded-md border bg-background px-2 py-1 text-sm"
                    defaultValue={m.roleKey}
                    disabled={!canManage || pending}
                    onChange={(e) => {
                      const roleKey = e.currentTarget.value;
                      void run(() => changeRoleAction(m.membershipId, roleKey));
                    }}
                  >
                    {ROLE_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {t(`roles.${key}`)}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  {canManage ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm(t('members.confirm_remove'))) {
                          void run(() => removeMemberAction(m.membershipId));
                        }
                      }}
                    >
                      {t('members.remove')}
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="font-medium">{t('invitations.title')}</h2>
        {invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('invitations.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <span dir="ltr">{inv.email}</span> · {t(`roles.${inv.roleKey}`)} ·{' '}
                  {t('invitations.expires', { date: new Date(inv.expiresAt).toLocaleDateString() })}
                </span>
                {canManage ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => void run(() => revokeInvitationAction(inv.id))}
                  >
                    {t('invitations.revoke')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage ? (
        <section className="flex flex-col gap-4 rounded-lg border p-4">
          <h2 className="font-medium">{t('invite.title')}</h2>
          <form onSubmit={onInvite} className="flex flex-col gap-4 sm:max-w-md">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-email">{t('invite.email')}</Label>
              <Input id="invite-email" name="email" type="email" dir="ltr" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-role">{t('invite.role')}</Label>
              <select
                id="invite-role"
                name="roleKey"
                defaultValue="staff"
                className="rounded-md border bg-background px-2 py-2 text-sm"
              >
                {INVITE_ROLE_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {t(`roles.${key}`)}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? t('invite.submitting') : t('invite.submit')}
            </Button>
          </form>

          {invite ? (
            <div className="flex flex-col gap-3 rounded-md bg-default p-3">
              <p className="text-sm font-medium">{t('invite.created')}</p>
              {invite.emailSent ? <p className="text-sm">{t('invite.email_sent')}</p> : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input readOnly dir="ltr" value={invite.url} aria-label={t('invite.link')} className="font-mono text-xs" />
                <Button type="button" variant="outline" onClick={() => void copyLink(invite.url)}>
                  {copied ? t('invite.copied') : t('invite.copy')}
                </Button>
              </div>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {t('invite.whatsapp')}
              </a>
            </div>
          ) : null}
          {!emailEnabled ? <p className="text-xs text-muted-foreground">{t('invite.email_disabled')}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
