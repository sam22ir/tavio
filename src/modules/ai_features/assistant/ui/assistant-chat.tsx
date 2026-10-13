'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { askAssistantAction, confirmAiAction, morningBriefingAction, rejectAiAction } from '../actions';
import { errorKey } from '../../errors';
import type { AssistantTable } from '../tools';
import { inputVariants } from '@heroui/styles';
import { ArrowUp, Sparkles, Sunrise } from 'lucide-react';
import { cn } from '@/ui/lib/cn';
import { Button } from '@/ui/primitives/button';
import { TintIcon } from '@/ui/blocks/tint';

const INPUT = cn(inputVariants({ variant: 'primary' }), 'min-h-11 flex-1 rounded-full px-4 text-sm');

/** A proposal as the server returns it. Kept loose: the summary is parsed defensively before rendering. */
interface ProposalView { id: string; kind: string; summary: unknown }
interface Turn { question: string; answer?: string; tables?: AssistantTable[]; proposals?: ProposalView[] }

/** Local state of one proposal after the user acted on it. */
type Decision =
  | { state: 'pending' }
  | { state: 'confirmed'; result: ReminderResult | InvoiceResult | null }
  | { state: 'rejected' }
  | { state: 'failed'; message: string };

interface ReminderResult { kind: 'reminder_batch'; items: { contractId: string; stage: string; text: string; whatsappUrl: string | null }[] }
interface InvoiceResult { kind: 'draft_invoice'; invoiceId: string }

interface ReminderRow { contractId: string; partnerName: string; contractNumber: string; daysLate: string; amountText: string; stage: string }
interface InvoiceView { partnerName: string; lines: { description: string; quantity: string; unitPriceText: string }[]; untaxedText: string; taxText: string; totalText: string }

const text = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Reads a reminder_batch summary. Returns null when the shape is not what the server writes. */
function readReminderSummary(raw: unknown): ReminderRow[] | null {
  const s = obj(raw);
  if (s.kind !== 'reminder_batch' || !Array.isArray(s.items)) return null;
  return list(s.items).map((item) => {
    const i = obj(item);
    return {
      contractId: text(i.contractId),
      partnerName: text(i.partnerName),
      contractNumber: text(i.contractNumber),
      daysLate: text(i.daysLate),
      amountText: text(i.amountText),
      stage: text(i.stage),
    };
  });
}

/** Reads a draft_invoice summary. Returns null when the shape is not what the server writes. */
function readInvoiceSummary(raw: unknown): InvoiceView | null {
  const s = obj(raw);
  if (s.kind !== 'draft_invoice') return null;
  return {
    partnerName: text(s.partnerName),
    lines: list(s.lines).map((l) => {
      const line = obj(l);
      return { description: text(line.description), quantity: text(line.quantity), unitPriceText: text(line.unitPriceText) };
    }),
    untaxedText: text(s.untaxedText),
    taxText: text(s.taxText),
    totalText: text(s.totalText),
  };
}

/** Reads a confirmed result. Unknown shapes are dropped rather than rendered. */
function readResult(raw: unknown): ReminderResult | InvoiceResult | null {
  const r = obj(raw);
  if (r.kind === 'reminder_batch' && Array.isArray(r.items)) {
    return {
      kind: 'reminder_batch',
      items: list(r.items).map((item) => {
        const i = obj(item);
        const link = text(i.whatsappUrl);
        return { contractId: text(i.contractId), stage: text(i.stage), text: text(i.text), whatsappUrl: link.startsWith('https://wa.me/') ? link : null };
      }),
    };
  }
  if (r.kind === 'draft_invoice' && typeof r.invoiceId === 'string') return { kind: 'draft_invoice', invoiceId: r.invoiceId };
  return null;
}

export function AssistantChat() {
  const t = useTranslations('ai_tools');
  const tShell = useTranslations('shell.dashboard.assistant');
  const [pending, start] = useTransition();
  const [, startAction] = useTransition();
  const [briefingPending, startBriefing] = useTransition();
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

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
      setTurns((cur) => cur.map((x, i) => (i === cur.length - 1 ? { ...x, answer: res.value.answer, tables: res.value.tables, proposals: res.value.proposals } : x)));
    });
  }

  /** Morning briefing: appends a turn labelled with the briefing, then fills it from the server. */
  function briefing() {
    setTurns((cur) => [...cur, { question: t('briefing.label') }]);
    startBriefing(async () => {
      const res = await morningBriefingAction({});
      if (!res.ok) {
        const message = t(errorKey(res.error.details));
        setTurns((cur) => cur.map((x, i) => (i === cur.length - 1 ? { ...x, answer: message } : x)));
        toast.error(message);
        return;
      }
      setTurns((cur) => cur.map((x, i) => (i === cur.length - 1 ? { ...x, answer: res.value.answer, tables: res.value.tables, proposals: res.value.proposals } : x)));
    });
  }

  /** Confirms or rejects one proposal. Both buttons stay disabled once the proposal has a decision. */
  function decide(id: string, action: 'confirm' | 'reject') {
    setDecisions((d) => ({ ...d, [id]: { state: 'pending' } }));
    startAction(async () => {
      if (action === 'reject') {
        const res = await rejectAiAction({ actionId: id });
        setDecisions((d) => ({ ...d, [id]: res.ok ? { state: 'rejected' } : { state: 'failed', message: t(errorKey(res.error.details)) } }));
        if (!res.ok) toast.error(t(errorKey(res.error.details)));
        return;
      }
      const res = await confirmAiAction({ actionId: id });
      if (!res.ok) {
        const message = t(errorKey(res.error.details));
        setDecisions((d) => ({ ...d, [id]: { state: 'failed', message } }));
        toast.error(message);
        return;
      }
      if (res.value.state === 'failed') {
        const message = t(res.value.errorCode === 'CONFLICT' ? 'actions.errors.conflict' : res.value.errorCode === 'VALIDATION' ? 'actions.errors.invalid' : 'actions.errors.generic');
        setDecisions((d) => ({ ...d, [id]: { state: 'failed', message } }));
        return;
      }
      setDecisions((d) => ({ ...d, [id]: { state: 'confirmed', result: readResult(res.value.result) } }));
    });
  }

  const starters = [tShell('prompts.overdue'), tShell('prompts.collections'), tShell('prompts.collected'), tShell('prompts.leads')];

  return (
    <div className="app-panel flex min-h-[28rem] flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-1 flex-col gap-4">
        {turns.length === 0 ? (
          <div className="m-auto flex max-w-md flex-col items-center gap-4 py-8 text-center">
            <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-[#7fb2ff] to-accent text-accent-foreground shadow-[0_8px_20px_-8px_rgb(8_64_157/0.6)]">
              <Sparkles className="size-6" />
            </span>
            <p className="text-sm text-muted">{tShell('hint')}</p>
            <div className="flex w-full flex-col gap-2">
              <Button size="lg" disabled={briefingPending || pending} onClick={briefing} className="w-full gap-2 rounded-2xl">
                <Sunrise aria-hidden="true" className="size-5 shrink-0" />
                {t('briefing.label')}
              </Button>
              <p className="text-xs text-muted">{t('briefing.hint')}</p>
            </div>
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
          <>
          <div className="flex justify-end">
            <Button size="sm" variant="outline" disabled={briefingPending || pending} onClick={briefing} className="gap-2 rounded-full">
              <Sunrise aria-hidden="true" className="size-4 shrink-0" />
              {t('briefing.label')}
            </Button>
          </div>
          <ol className="flex flex-col gap-5">
            {turns.map((turn, i) => (
              <li key={i} className="flex flex-col gap-3">
                <p className="max-w-[85%] self-end rounded-3xl bg-accent px-4 py-2.5 text-sm text-accent-foreground">{turn.question}</p>
                <div className="flex items-start gap-3">
                  <TintIcon icon={Sparkles} tint="info" className="size-8" />
                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    {turn.answer === undefined ? <p className="text-sm text-muted">{t('assistant.thinking')}</p> : turn.answer ? <p className="text-sm leading-relaxed">{turn.answer}</p> : !turn.tables?.length && !turn.proposals?.length ? <p className="text-sm text-muted">{t('briefing.unavailable')}</p> : null}
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
                    {turn.proposals?.map((p) => (
                      <ProposalCard key={p.id} proposal={p} decision={decisions[p.id]} onDecide={decide} />
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          </>
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

interface ProposalCardProps {
  proposal: ProposalView;
  decision: Decision | undefined;
  onDecide: (id: string, action: 'confirm' | 'reject') => void;
}

/** One proposed action: its title, the server-computed summary, Confirm and Reject, then the outcome. */
function ProposalCard({ proposal, decision, onDecide }: ProposalCardProps) {
  const t = useTranslations('ai_tools');
  const locale = useLocale();
  const known = proposal.kind === 'reminder_batch' || proposal.kind === 'draft_invoice';
  const reminders = proposal.kind === 'reminder_batch' ? readReminderSummary(proposal.summary) : null;
  const invoice = proposal.kind === 'draft_invoice' ? readInvoiceSummary(proposal.summary) : null;
  const summaryOk = known && (reminders !== null || invoice !== null);
  const busy = decision !== undefined;

  return (
    <section aria-label={t(`actions.kind.${known ? proposal.kind : 'unknown'}`)} className="flex flex-col gap-3 rounded-2xl border border-separator bg-surface-secondary/40 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{known ? t(`actions.kind.${proposal.kind}`) : t('actions.unsupported')}</p>

      {!summaryOk ? (
        known ? <p className="text-sm text-muted">{t('actions.unavailable')}</p> : null
      ) : reminders ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {(['customer', 'contract', 'daysLate', 'amount', 'stage'] as const).map((c) => (
                  <th key={c} className="px-3 py-2 text-xs uppercase tracking-wide text-muted text-start font-medium">{t(`actions.summary.${c}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reminders.map((r) => (
                <tr key={r.contractId} className="border-t border-separator">
                  <td className="px-3 py-2">{r.partnerName}</td>
                  <td className="px-3 py-2">{r.contractNumber}</td>
                  <td className="px-3 py-2">{r.daysLate}</td>
                  <td className="px-3 py-2">{r.amountText}</td>
                  <td className="px-3 py-2">{['polite', 'firm', 'final'].includes(r.stage) ? t(`actions.stage.${r.stage}`) : r.stage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : invoice ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{invoice.partnerName}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {(['description', 'quantity', 'unitPrice'] as const).map((c) => (
                    <th key={c} className="px-3 py-2 text-xs uppercase tracking-wide text-muted text-start font-medium">{t(`actions.summary.${c}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((l, k) => (
                  <tr key={k} className="border-t border-separator">
                    <td className="px-3 py-2">{l.description}</td>
                    <td className="px-3 py-2">{l.quantity}</td>
                    <td className="px-3 py-2">{l.unitPriceText}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">{t('actions.summary.untaxed')}</dt><dd className="text-end">{invoice.untaxedText}</dd>
            <dt className="text-muted">{t('actions.summary.tax')}</dt><dd className="text-end">{invoice.taxText}</dd>
            <dt className="font-medium">{t('actions.summary.total')}</dt><dd className="text-end font-medium">{invoice.totalText}</dd>
          </dl>
        </div>
      ) : null}

      {summaryOk && !busy ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onDecide(proposal.id, 'confirm')}>{t('actions.confirm')}</Button>
          <Button size="sm" variant="outline" onClick={() => onDecide(proposal.id, 'reject')}>{t('actions.reject')}</Button>
        </div>
      ) : null}

      {decision?.state === 'pending' ? <p className="text-sm text-muted">{t('actions.pending')}</p> : null}
      {decision?.state === 'rejected' ? <p className="text-sm text-muted">{t('actions.rejected')}</p> : null}
      {decision?.state === 'failed' ? <p role="alert" className="text-sm text-destructive">{t('actions.failed')}: {decision.message}</p> : null}

      {decision?.state === 'confirmed' ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">{t('actions.confirmed')}</p>
          {decision.result?.kind === 'reminder_batch' ? (
            <>
              <p className="text-xs text-muted">{t('actions.preparedHint')}</p>
              <ul className="flex flex-col gap-2">
                {decision.result.items.map((item) => (
                  <li key={item.contractId} className="flex flex-col gap-2 rounded-xl bg-surface-secondary p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">{t('actions.prepared')}</p>
                    <p className="whitespace-pre-line text-sm leading-relaxed">{item.text}</p>
                    <div className="flex flex-wrap gap-2">
                      {item.whatsappUrl ? (
                        <Button asChild size="sm" variant="outline">
                          <a href={item.whatsappUrl} target="_blank" rel="noopener noreferrer">{t('actions.whatsapp')}</a>
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" onClick={() => copyText(item.text, t)}>{t('actions.copy')}</Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : decision.result?.kind === 'draft_invoice' ? (
            <Link href={`/${locale}/invoicing/customers/${decision.result.invoiceId}`} className="text-sm font-medium text-accent underline-offset-4 hover:underline">
              {t('actions.openInvoice')}
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

async function copyText(value: string, t: (key: string) => string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(t('actions.copied'));
  } catch {
    toast.error(t('actions.copyFailed'));
  }
}
