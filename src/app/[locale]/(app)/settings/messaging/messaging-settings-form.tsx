'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import { Textarea } from '@/ui/primitives/textarea';
import {
  resetTemplateFormAction,
  saveMessageSettingsAction,
  saveTemplateFormAction,
} from '@/core/messaging/actions';
import { findUnknownVariables, renderMessage, SAMPLE_VARS, type MessageLocale, type TemplateKey } from '@/core/messaging/template';
import type { MessageSettingsValues, TemplateView } from '@/core/messaging/service';

/** Template editor with a live preview, plus the automatic reminder settings. */
export function MessagingSettingsForm({ templates, settings }: { templates: TemplateView[]; settings: MessageSettingsValues }) {
  const t = useTranslations('messaging.settings');
  const ts = useTranslations('messaging.send');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [keyIdx, setKeyIdx] = useState(0);
  const [locale, setLocale] = useState<MessageLocale>('fr');
  const [draft, setDraft] = useState<Record<string, { subject: string; body: string }>>(() => toDraft(templates));
  const [error, setError] = useState<string | null>(null);
  const [remindersEnabled, setRemindersEnabled] = useState(settings.remindersEnabled);
  const [beforeDays, setBeforeDays] = useState(String(settings.beforeDays));
  const [overdueDays, setOverdueDays] = useState(settings.overdueDays.join(', '));

  const key = templates.filter((x) => x.locale === 'fr')[keyIdx]?.key ?? 'quote_sent';
  const id = `${key}:${locale}`;
  const current = templates.find((x) => x.key === key && x.locale === locale);
  const values = useMemo(() => draft[id] ?? { subject: '', body: '' }, [draft, id]);
  const unknown = useMemo(() => [...new Set([...findUnknownVariables(key as TemplateKey, values.subject), ...findUnknownVariables(key as TemplateKey, values.body)])], [key, values]);
  const preview = useMemo(() => renderMessage({ subject: values.subject, body: values.body }, SAMPLE_VARS), [values]);

  function setField(field: 'subject' | 'body', value: string): void {
    setDraft((d) => ({ ...d, [id]: { ...values, [field]: value } }));
  }

  function save(): void {
    setError(null);
    start(async () => {
      const res = await saveTemplateFormAction({ key: key as TemplateKey, locale, subject: values.subject, body: values.body });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      toast.success(t('saved'));
      router.refresh();
    });
  }

  function reset(): void {
    setError(null);
    start(async () => {
      const res = await resetTemplateFormAction({ key: key as TemplateKey, locale });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      const base = templates.find((x) => x.key === key && x.locale === locale);
      setDraft((d) => ({ ...d, [id]: { subject: base?.subject ?? '', body: base?.body ?? '' } }));
      router.refresh();
    });
  }

  function saveReminders(): void {
    setError(null);
    const overdue = overdueDays.split(',').map((s) => s.trim()).filter(Boolean).map(Number);
    start(async () => {
      const res = await saveMessageSettingsAction({ remindersEnabled, beforeDays: Number(beforeDays), overdueDays: overdue });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      toast.success(t('saved'));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <h2 className="font-medium">{t('templates')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tpl-key">{t('templates')}</Label>
            <select id="tpl-key" className="h-11 rounded-md border bg-background px-3 text-sm" value={keyIdx} onChange={(e) => setKeyIdx(Number(e.target.value))}>
              {templates.filter((x) => x.locale === 'fr').map((x, i) => (
                <option key={x.key} value={i}>{t(`keys.${x.key}`)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tpl-locale">{t('locale.fr')} / {t('locale.ar')}</Label>
            <select id="tpl-locale" className="h-11 rounded-md border bg-background px-3 text-sm" value={locale} onChange={(e) => setLocale(e.target.value as MessageLocale)}>
              <option value="fr">{t('locale.fr')}</option>
              <option value="ar">{t('locale.ar')}</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {current?.isDefault ? t('isDefault') : t('custom')} · {t('variables', { vars: (current?.variables ?? []).map((v) => `{${v}}`).join(' ') })}
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tpl-subject">{ts('subject')}</Label>
          <Input id="tpl-subject" dir="auto" value={values.subject} onChange={(e) => setField('subject', e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tpl-body">{ts('body')}</Label>
          <Textarea id="tpl-body" dir="auto" rows={8} value={values.body} onChange={(e) => setField('body', e.target.value)} />
        </div>
        {unknown.length > 0 ? (
          <p role="alert" className="text-sm text-destructive">{t('unknownVar', { vars: unknown.map((v) => `{${v}}`).join(' ') })}</p>
        ) : null}
        <div className="flex flex-col gap-2 rounded-md bg-default/40 p-3">
          <h3 className="text-sm font-medium">{t('preview')}</h3>
          <p className="text-xs text-muted-foreground">{t('previewHelp')}</p>
          <p dir="auto" className="text-sm font-semibold">{preview.subject}</p>
          <div dir="auto" className="whitespace-pre-line text-sm">{preview.text}</div>
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save} disabled={pending || unknown.length > 0} className="min-h-11">{t('save')}</Button>
          <Button type="button" variant="outline" onClick={reset} disabled={pending} className="min-h-11">{t('reset')}</Button>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <h2 className="font-medium">{t('reminders')}</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" checked={remindersEnabled} onChange={(e) => setRemindersEnabled(e.target.checked)} />
          {t('remindersEnabled')}
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="before-days">{t('beforeDays')}</Label>
            <Input id="before-days" inputMode="numeric" value={beforeDays} onChange={(e) => setBeforeDays(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="overdue-days">{t('overdueDays')}</Label>
            <Input id="overdue-days" value={overdueDays} onChange={(e) => setOverdueDays(e.target.value)} />
            <span className="text-xs text-muted-foreground">{t('overdueHelp')}</span>
          </div>
        </div>
        <div>
          <Button type="button" onClick={saveReminders} disabled={pending} className="min-h-11">{t('save')}</Button>
        </div>
      </section>
    </div>
  );
}

function toDraft(templates: TemplateView[]): Record<string, { subject: string; body: string }> {
  const out: Record<string, { subject: string; body: string }> = {};
  for (const x of templates) out[`${x.key}:${x.locale}`] = { subject: x.subject, body: x.body };
  return out;
}
