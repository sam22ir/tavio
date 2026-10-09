'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { askAssistantAction } from '../actions';
import { errorKey } from '../../errors';
import type { AssistantTable } from '../tools';

const INPUT = 'min-h-11 flex-1 rounded-md border border-input bg-background px-3 text-sm';

interface Turn { question: string; answer?: string; tables?: AssistantTable[] }

export function AssistantChat() {
  const t = useTranslations('ai_tools');
  const [pending, start] = useTransition();
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);

  function ask() {
    const q = question.trim();
    if (q.length < 3) return;
    setQuestion('');
    setTurns((cur) => [...cur, { question: q }]);
    start(async () => {
      const res = await askAssistantAction({ question: q });
      if (!res.ok) {
        setTurns((cur) => cur.map((x, i) => (i === cur.length - 1 ? { ...x, answer: t(errorKey(res.error.details)) } : x)));
        toast.error(t(errorKey(res.error.details))); return;
      }
      setTurns((cur) => cur.map((x, i) => (i === cur.length - 1 ? { ...x, answer: res.value.answer, tables: res.value.tables } : x)));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-4">
        {turns.map((turn, i) => (
          <li key={i} className="flex flex-col gap-2">
            <p className="self-end rounded-md bg-muted px-3 py-2 text-sm">{turn.question}</p>
            {turn.answer ? <p className="text-sm">{turn.answer}</p> : <p className="text-sm text-muted-foreground">{t('assistant.thinking')}</p>}
            {turn.tables?.map((tbl, j) => (
              <div key={j} className="overflow-x-auto rounded-md border">
                <p className="px-3 py-2 text-xs font-medium">{tbl.title}</p>
                <table className="w-full text-sm">
                  <thead><tr>{tbl.columns.map((c) => <th key={c} className="px-3 py-1 text-start font-medium">{c}</th>)}</tr></thead>
                  <tbody>
                    {tbl.rows.length === 0 ? (
                      <tr><td className="px-3 py-1" colSpan={tbl.columns.length}>{t('assistant.empty')}</td></tr>
                    ) : tbl.rows.map((r, k) => (
                      <tr key={k}>{r.map((cell, c) => <td key={c} className="px-3 py-1">{cell}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </li>
        ))}
      </ol>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!pending) ask(); }}>
        <input className={INPUT} value={question} maxLength={500} placeholder={t('assistant.placeholder')} aria-label={t('assistant.placeholder')} onChange={(e) => setQuestion(e.target.value)} />
        <button type="submit" disabled={pending || question.trim().length < 3} className="min-h-11 rounded-md bg-primary px-4 text-primary-foreground disabled:opacity-50">
          {t('assistant.ask')}
        </button>
      </form>
    </div>
  );
}
