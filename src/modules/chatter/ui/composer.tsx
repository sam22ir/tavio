'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ACTIVITY_TYPE_SEED } from '../entities';
import { completeActivityAction, postMessageAction, scheduleActivityAction } from '../actions';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import { Textarea } from '@/ui/primitives/textarea';

interface Common {
  entity: string;
  recordId: string;
}

/** Composer with "Send message" and "Log note" tabs. */
export function Composer({ entity, recordId }: Common) {
  const t = useTranslations('chatter.thread');
  const router = useRouter();
  const [mode, setMode] = useState<'comment' | 'note'>('comment');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await postMessageAction({ entity, recordId, body, kind: mode });
      if (!res.ok) {
        setError(t('error'));
        return;
      }
      setBody('');
      router.refresh();
    });
  }

  const tabClass = (active: boolean) =>
    `flex-1 rounded-md px-3 py-2 text-sm font-medium ${active ? 'bg-background shadow-sm' : 'text-muted-foreground'}`;

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div role="tablist" className="flex gap-1 rounded-lg bg-muted p-1">
        <button type="button" role="tab" aria-selected={mode === 'comment'} className={tabClass(mode === 'comment')} onClick={() => setMode('comment')}>
          {t('tabMessage')}
        </button>
        <button type="button" role="tab" aria-selected={mode === 'note'} className={tabClass(mode === 'note')} onClick={() => setMode('note')}>
          {t('tabNote')}
        </button>
      </div>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={mode === 'comment' ? t('placeholderMessage') : t('placeholderNote')}
        rows={3}
        maxLength={10000}
      />
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="button" onClick={submit} disabled={pending || body.trim().length === 0}>
          {mode === 'comment' ? t('send') : t('logNote')}
        </Button>
      </div>
    </div>
  );
}

/** Schedule form: type, summary, due date and assignee (default: me). */
export function ScheduleActivityForm({
  entity,
  recordId,
  currentUserId,
  assignees,
}: Common & { currentUserId: string; assignees: { id: string; name: string }[] }) {
  const t = useTranslations('chatter.activity');
  const tt = useTranslations('chatter.type');
  const router = useRouter();
  const [typeKey, setTypeKey] = useState<string>(ACTIVITY_TYPE_SEED[0].key);
  const [summary, setSummary] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [assigneeId, setAssigneeId] = useState(currentUserId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await scheduleActivityAction({
        entity,
        recordId,
        typeKey: typeKey as (typeof ACTIVITY_TYPE_SEED)[number]['key'],
        summary,
        dueDate,
        assigneeId,
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setSummary('');
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-3">
      <h3 className="font-medium">{t('schedule')}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="activity-type">{t('type')}</Label>
          <select
            id="activity-type"
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={typeKey}
            onChange={(e) => setTypeKey(e.target.value)}
          >
            {ACTIVITY_TYPE_SEED.map((s) => (
              <option key={s.key} value={s.key}>{tt(s.key)}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="activity-due">{t('dueDate')}</Label>
          <Input id="activity-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label htmlFor="activity-summary">{t('summary')}</Label>
          <Input id="activity-summary" value={summary} maxLength={200} onChange={(e) => setSummary(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label htmlFor="activity-assignee">{t('assignee')}</Label>
          <select
            id="activity-assignee"
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
          >
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="button" onClick={submit} disabled={pending || summary.trim().length === 0 || !dueDate}>
          {t('submit')}
        </Button>
      </div>
    </section>
  );
}

/** "Mark done" for one open activity. */
export function MarkDoneButton({ id }: { id: string }) {
  const t = useTranslations('chatter.activity');
  const te = useTranslations('chatter.thread');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await completeActivityAction({ id });
            if (!res.ok) {
              setError(true);
              return;
            }
            router.refresh();
          })
        }
      >
        {t('markDone')}
      </Button>
      {error ? <span role="alert" className="text-xs text-destructive">{te('error')}</span> : null}
    </span>
  );
}
