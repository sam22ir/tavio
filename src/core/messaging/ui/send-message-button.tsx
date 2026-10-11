'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/ui/primitives/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/primitives/dialog';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import { Textarea } from '@/ui/primitives/textarea';
import { prepareDocumentMessageAction, sendDocumentMessageAction } from '../actions';
import type { DocumentEntity, MessageChannelId } from '../service';
import type { TemplateKey } from '../template';

type Props = {
  entity: DocumentEntity;
  recordId: string;
  partnerId: string;
  templateKey: TemplateKey;
  /** Portal invite: sends a sign-in link instead of the document. */
  invite?: boolean;
  label?: string;
};

/** "Envoyer" / "Inviter au portail": a dialog with the prepared message, editable before it is queued. */
export function SendMessageButton({ entity, recordId, partnerId, templateKey, invite = false, label }: Props) {
  const t = useTranslations('messaging.send');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<MessageChannelId>('email');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [optedOut, setOptedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waUrl, setWaUrl] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [sending, startSend] = useTransition();

  function load(next: MessageChannelId): void {
    setError(null);
    setWaUrl(null);
    startLoad(async () => {
      const res = await prepareDocumentMessageAction({ entity, recordId, partnerId, templateKey, channel: next });
      if (!res.ok) {
        setError(t('error'));
        return;
      }
      setTo(res.value.to);
      setSubject(res.value.subject);
      setBody(res.value.body);
      setOptedOut(res.value.optedOut);
    });
  }

  function onOpenChange(next: boolean): void {
    setOpen(next);
    if (next) load(channel);
  }

  function changeChannel(next: MessageChannelId): void {
    setChannel(next);
    load(next);
  }

  function send(): void {
    setError(null);
    startSend(async () => {
      const res = await sendDocumentMessageAction({ entity, recordId, partnerId, templateKey, channel, to, subject, body });
      if (!res.ok) {
        setError(t('errorCode', { message: res.error.message }));
        return;
      }
      if (res.value.state === 'manual' && res.value.waUrl) {
        setWaUrl(res.value.waUrl);
        return;
      }
      toast.success(t('queued'));
      setOpen(false);
      router.refresh();
    });
  }

  const triggerLabel = label ?? (invite ? t('invite') : t('button'));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant={invite ? 'outline' : 'default'} className="min-h-11 print:hidden">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{invite ? t('inviteTitle') : t('title')}</DialogTitle>
          <DialogDescription>{invite ? t('inviteHelp') : t('bodyHelp')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="msg-channel">{t('channel')}</Label>
            <select
              id="msg-channel"
              className="h-11 rounded-md border bg-background px-3 text-sm"
              value={channel}
              onChange={(e) => changeChannel(e.target.value as MessageChannelId)}
              disabled={loading || sending}
            >
              <option value="email">{t('email')}</option>
              <option value="whatsapp">{t('whatsapp')}</option>
            </select>
          </div>

          {optedOut && channel === 'email' ? (
            <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{t('optedOut')}</p>
          ) : null}
          {!loading && !to ? <p className="text-sm text-muted-foreground">{t('noRecipient')}</p> : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="msg-to">{t('to')}</Label>
            <Input id="msg-to" value={to} onChange={(e) => setTo(e.target.value)} disabled={loading || sending} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="msg-subject">{t('subject')}</Label>
            <Input id="msg-subject" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={loading || sending || channel === 'whatsapp'} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="msg-body">{t('body')}</Label>
            <Textarea id="msg-body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} disabled={loading || sending} />
          </div>

          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          {waUrl ? (
            <a href={waUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              {t('openWhatsapp')}
            </a>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} className="min-h-11">{t('cancel')}</Button>
          {waUrl ? null : (
            <Button type="button" onClick={send} disabled={loading || sending || !to || !body} className="min-h-11">
              {t('submit')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
