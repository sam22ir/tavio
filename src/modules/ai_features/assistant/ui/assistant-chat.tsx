'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { askAssistantAction } from '../actions';
import { errorKey } from '../../errors';
import type { AssistantTable } from '../tools';
import { inputVariants } from '@heroui/styles';
import { ArrowUp, Sparkles } from 'lucide-react';
import { cn } from '@/ui/lib/cn';
import { Button } from '@/ui/primitives/button';
import { TintIcon } from '@/ui/blocks/tint';

const INPUT = cn(inputVariants({ variant: 'primary' }), 'min-h-11 flex-1 rounded-full px-4 text-sm');

interface Turn { question: string; answer?: string; tables?: AssistantTable[] }

export function AssistantChat() {
  const t = useTranslations('ai_tools');
  const tShell = useTranslations('shell.dashboard.assistant');
  const [pending, start] = useTransition();
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);

  function ask(override?: string) {
    const q = (override ?? question).trim();
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

  const starters = [tShell('prompts.overdue'), tShell('prompts.collected'), tShell('prompts.leads')];

  return (
    <div className="app-panel flex min-h-[28rem] flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-1 flex-col gap-4">
        {turns.length === 0 ? (
          <div className="m-auto flex max-w-md flex-col items-center gap-4 py-8 text-center">
            <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-[#7fb2ff] to-accent text-accent-foreground shadow-[0_8px_20px_-8px_rgb(8_64_157/0.6)]">
              <Sparkles className="size-6" />
            </span>
            <p className="text-sm text-muted">{tShell('hint')}</p>
            <ul className="flex w-full flex-col gap-2">
              {starters.map((q) => (
                <li key={q}>
                  <button type="button" disabled={pending} onClick={() => ask(q)} className="flex w-full items-center gap-2 rounded-2xl bg-surface-secondary px-3 py-2.5 text-start text-sm transition-colors hover:bg-default disabled:opacity-50">
                    <Sparkles aria-hidden="true" className="size-4 shrink-0 text-accent" />
                    <span className="min-w-0 flex-1">{q}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol className="flex flex-col gap-5">
            {turns.map((turn, i) => (
              <li key={i} className="flex flex-col gap-3">
                <p className="max-w-[85%] self-end rounded-3xl bg-accent px-4 py-2.5 text-sm text-accent-foreground">{turn.question}</p>
                <div className="flex items-start gap-3">
                  <TintIcon icon={Sparkles} tint="info" className="size-8" />
                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    {turn.answer ? <p className="text-sm leading-relaxed">{turn.answer}</p> : <p className="text-sm text-muted">{t('assistant.thinking')}</p>}
                    {turn.tables?.map((tbl, j) => (
                      <div key={j} className="overflow-x-auto rounded-2xl bg-surface-secondary/60">
                        <p className="px-4 pt-3 text-xs font-medium">{tbl.title}</p>
                        <table className="w-full text-sm">
                          <thead><tr>{tbl.columns.map((c) => <th key={c} className="px-4 py-3 text-xs uppercase tracking-wide text-muted text-start font-medium">{c}</th>)}</tr></thead>
                          <tbody>
                            {tbl.rows.length === 0 ? (
                              <tr><td className="px-4 py-3" colSpan={tbl.columns.length}>{t('assistant.empty')}</td></tr>
                            ) : tbl.rows.map((r, k) => (
                              <tr key={k} className="border-t border-separator">{r.map((cell, c) => <td key={c} className="px-4 py-3">{cell}</td>)}</tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (!pending) ask(); }}>
        <input className={INPUT} value={question} maxLength={500} placeholder={t('assistant.placeholder')} aria-label={t('assistant.placeholder')} onChange={(e) => setQuestion(e.target.value)} />
        <Button type="submit" size="icon" disabled={pending || question.trim().length < 3} aria-label={t('assistant.ask')} className="shrink-0 rounded-full">
          <ArrowUp aria-hidden="true" className="size-5" />
        </Button>
      </form>
    </div>
  );
}
