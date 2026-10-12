'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/ui/primitives/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/primitives/dialog';
import { Label } from '@/ui/primitives/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/primitives/select';
import { Textarea } from '@/ui/primitives/textarea';
import { draftReminder } from '@/modules/ai_features/reminders/actions';
import type { ReminderLanguage, ReminderTone } from '@/modules/ai_features/reminders/prompt';
import { whatsappLink } from '@/modules/credit_sales/service/reminders';

interface Props {
  contractId: string;
  phone: string | null;
}

/** Per-row AI draft: tone and language, an editable text, then a WhatsApp link. */
export function AiDraftButton({ contractId, phone }: Props) {
  const t = useTranslations('ai_search');
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState<ReminderTone>('polite');
  const [language, setLanguage] = useState<ReminderLanguage>('fr');
  const [text, setText] = useState('');
  const [source, setSource] = useState<'ai' | 'template' | null>(null);
  const [pending, startTransition] = useTransition();

  const generate = () =>
    startTransition(async () => {
      const res = await draftReminder({ contractId, tone, language });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setText(res.value.text);
      setSource(res.value.source);
    });

  const waHref = text.trim() ? whatsappLink(phone, text.trim()) : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">{t('draft.button')}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('draft.title')}</DialogTitle>
          <DialogDescription>{t('draft.description')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label>{t('draft.tone.label')}</Label>
            <Select value={tone} onValueChange={(v) => setTone(v as ReminderTone)} aria-label={t('draft.tone.label')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="polite">{t('draft.tone.polite')}</SelectItem>
                <SelectItem value="firm">{t('draft.tone.firm')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>{t('draft.language.label')}</Label>
            <Select value={language} onValueChange={(v) => setLanguage(v as ReminderLanguage)} aria-label={t('draft.language.label')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">{t('draft.language.fr')}</SelectItem>
                <SelectItem value="ar">{t('draft.language.ar')}</SelectItem>
                <SelectItem value="darija">{t('draft.language.darija')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={generate} disabled={pending}>
          {pending ? t('draft.generating') : t('draft.generate')}
        </Button>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={400}
          rows={6}
          aria-label={t('draft.text_label')}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{source ? t(`draft.source.${source}`) : null}</span>
          <span>{text.length}/400</span>
        </div>
        {waHref ? (
          <a href={waHref} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline">
            {t('draft.open_whatsapp')}
          </a>
        ) : (
          <p className="text-sm text-muted">{phone ? null : t('draft.no_phone')}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
