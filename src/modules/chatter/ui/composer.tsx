'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { completeActivityAction, postMessageAction, scheduleActivityAction } from '../actions';
import type { NextSuggestion } from '../service';
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
      <div role="tablist" className="flex gap-1 rounded-lg bg-default p-1">
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
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="button" onClick={submit} disabled={pending || body.trim().length === 0}>
          {mode === 'comment' ? t('send') : t('logNote')}
        </Button>
      </div>
    </div>
  );
}

/** Schedule form: activity type, summary, due date and assignee (default: me). */
export function ScheduleActivityForm({
  entity,
  recordId,
  currentUserId,
  assignees,
  types,
}: Common & {
  currentUserId: string;
  assignees: { id: string; name: string }[];
  types: { id: string; label: string }[];
}) {
  const t = useTranslations('chatter.activity');
  const router = useRouter();
  const [activityTypeId, setActivityTypeId] = useState<string>(types[0]?.id ?? '');
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
        activityTypeId,
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
            className="h-11 rounded-xl border border-separator bg-surface px-3 text-sm"
            value={activityTypeId}
            onChange={(e) => setActivityTypeId(e.target.value)}
          >
            {types.map((ty) => (
              <option key={ty.id} value={ty.id}>{ty.label}</option>
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
            className="h-11 rounded-xl border border-separator bg-surface px-3 text-sm"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
          >
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={submit}
          disabled={pending || summary.trim().length === 0 || !dueDate || !activityTypeId}
        >
          {t('submit')}
        </Button>
      </div>
    </section>
  );
}

/**
 * Per-activity controls. Open: "Mark done" with a result (required when the type says so) and an optional note.
 * Done: offers the suggested next activity from chaining_type = suggest.
 * Stays mounted after the activity is completed, so the suggestion survives router.refresh().
 */
export function ActivityActions({
  id,
  entity,
  recordId,
  requireResult,
  open,
}: Common & { id: string; requireResult: boolean; open: boolean }) {
  const t = useTranslations('chatter.activity');
  const te = useTranslations('chatter.thread');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [result, setResult] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState<NextSuggestion | null>(null);

  function complete() {
    setError(null);
    startTransition(async () => {
      const res = await completeActivityAction({ id, result: result.trim() || undefined, feedback: feedback.trim() || undefined });
      if (!res.ok) {
        setError(res.error.code === 'VALIDATION' ? t('resultRequired') : te('error'));
        return;
      }
      setNext(res.value.next);
      setExpanded(false);
      setResult('');
      setFeedback('');
      router.refresh();
    });
  }

  function scheduleNext(suggestion: NextSuggestion) {
    setError(null);
    startTransition(async () => {
      const res = await scheduleActivityAction({
        entity,
        recordId,
        activityTypeId: suggestion.activityTypeId,
        summary: suggestion.summary,
        dueDate: suggestion.dueDate,
        assigneeId: suggestion.assigneeId,
      });
      if (!res.ok) {
        setError(te('error'));
        return;
      }
      setNext(null);
      router.refresh();
    });
  }

  if (!open) {
    if (!next) return null;
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm">
        <span>{t('suggestedNext', { date: next.dueDate })}</span>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => scheduleNext(next)}>
          {t('scheduleNext')}
        </Button>
      </div>
    );
  }

  if (!expanded) {
    return (
      <div className="flex justify-end">
        <Button type="button" size="sm" variant="outline" onClick={() => setExpanded(true)}>
          {t('markDone')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t pt-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          aria-label={t('result')}
          placeholder={requireResult ? t('resultPlaceholderRequired') : t('resultPlaceholder')}
          value={result}
          maxLength={100}
          onChange={(e) => setResult(e.target.value)}
        />
        <Input
          aria-label={t('feedbackPlaceholder')}
          placeholder={t('feedbackPlaceholder')}
          value={feedback}
          maxLength={1000}
          onChange={(e) => setFeedback(e.target.value)}
        />
      </div>
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setExpanded(false)}>
          {t('cancel')}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending || (requireResult && !result.trim())} onClick={complete}>
          {t('markDone')}
        </Button>
      </div>
    </div>
  );
}
