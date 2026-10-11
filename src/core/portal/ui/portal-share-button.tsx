'use client';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { createPortalDocumentLinkAction, createPortalInviteAction, type PortalShareResult } from '../share-actions';

type Props =
  | { mode: 'document'; kind: 'invoice' | 'contract'; id: string; label?: string }
  | { mode: 'invite'; partnerId: string; label?: string };

/** Creates a portal link and shows it with copy, WhatsApp and email actions. The link is never written to chatter. */
export function PortalShareButton(props: Props) {
  const t = useTranslations('portal.share');
  const [result, setResult] = useState<PortalShareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function create(): void {
    setError(null);
    start(async () => {
      const res = props.mode === 'document'
        ? await createPortalDocumentLinkAction({ kind: props.kind, id: props.id })
        : await createPortalInviteAction({ partnerId: props.partnerId });
      if (res.ok) setResult(res.value);
      else setError(t('error'));
    });
  }

  async function copy(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError(t('copyFailed'));
    }
  }

  const label = props.label ?? (props.mode === 'invite' ? t('invite') : t('button'));
  const message = result ? (props.mode === 'invite' ? t('messageInvite', { url: result.url }) : t('messageDocument', { url: result.url })) : '';
  const phoneDigits = result?.phone ? result.phone.replace(/\D/g, '') : '';
  const waHref = result ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}` : '#';
  const mailHref = result ? `mailto:?subject=${encodeURIComponent(t('emailSubject'))}&body=${encodeURIComponent(message)}` : '#';

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={create}
        disabled={pending}
        className="min-h-11 rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium disabled:opacity-50"
      >
        {pending ? t('creating') : label}
      </button>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {result ? (
        <div role="region" aria-label={t('title')} className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-sm font-medium">{t('title')}</p>
          <input readOnly value={result.url} dir="ltr" onFocus={(e) => e.currentTarget.select()}
            className="min-h-11 w-full rounded-lg border border-stone-300 px-3 text-sm" />
          <p className="text-xs text-stone-500">{t('expires', { date: new Date(result.expiresAt).toLocaleDateString() })}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => copy(result.url)} className="min-h-11 rounded-lg border border-stone-300 px-3 text-sm">
              {copied ? t('copied') : t('copy')}
            </button>
            <a href={waHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-stone-300 px-3 text-sm">
              {t('whatsapp')}
            </a>
            <a href={mailHref} className="inline-flex min-h-11 items-center rounded-lg border border-stone-300 px-3 text-sm">
              {t('email')}
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
