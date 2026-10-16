'use client';

import { useMemo, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { formatDzd } from '@/core/money';
import type { Result } from '@/core/result';
import { Badge } from '@/ui/primitives/badge';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import {
  addManualLine,
  closeBankStatement,
  createEntryFromLine,
  matchStatementLine,
  setStatementLineIgnored,
  unmatchStatementLine,
} from '../reconciliation-actions';
import type { CandidateDto, LineDto, StatementDto } from './reconciliation-dto';
import { scopedKey } from './bank-statement-import';
import { messageKeyOf } from './reconciliation-dto';

const big = (v: string): bigint => BigInt(v);

/** Two-column workbench: statement lines on the left, candidate entries on the right, with the running difference. */
export function StatementWorkbench({ statement }: { statement: StatementDto }) {
  const t = useTranslations('accounting.reconciliation');
  const locale = useLocale() as 'fr' | 'ar' | 'en';
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [counterId, setCounterId] = useState(statement.counterAccounts[0]?.id ?? '');
  const isOpen = statement.state === 'open';

  const active: LineDto | null = useMemo(
    () => statement.lines.find((l) => l.id === activeId) ?? statement.lines.find((l) => l.state === 'unmatched') ?? null,
    [statement.lines, activeId],
  );
  const proposals = useMemo(() => (active ? statement.proposals[active.id] ?? [] : []), [active, statement.proposals]);
  const best = proposals[0];
  const proposedIds = useMemo(() => new Set(proposals.flatMap((p) => p.journalLineIds)), [proposals]);
  const unmatchedCount = statement.lines.filter((l) => l.state === 'unmatched').length;
  const gap = big(statement.gap);
  const canClose = isOpen && unmatchedCount === 0 && gap === BigInt(0);

  const candidates = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const rows = statement.candidates.filter((c) => {
      if (!q) return true;
      return c.entryNumber.toLowerCase().includes(q) || (c.lineLabel ?? '').toLowerCase().includes(q) || c.value.includes(q);
    });
    // Proposed candidates for the active line come first.
    return [...rows].sort((a, b) => Number(proposedIds.has(b.journalLineId)) - Number(proposedIds.has(a.journalLineId)));
  }, [statement.candidates, filter, proposedIds]);

  const selectedSum = statement.candidates
    .filter((c) => selected.has(c.journalLineId))
    .reduce((acc, c) => acc + big(c.value), BigInt(0));

  function errorText(error: { code: string; details?: Record<string, unknown> }): string {
    return t(scopedKey(messageKeyOf(error), 'errors.' + error.code.toLowerCase()));
  }

  function run<T>(fn: () => Promise<Result<T>>, okText?: (value: T) => string) {
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setMessage({ kind: 'error', text: errorText(res.error) });
        return;
      }
      setSelected(new Set());
      if (okText) setMessage({ kind: 'ok', text: okText(res.value) });
      router.refresh();
    });
  }

  function money(v: string): string {
    return formatDzd(big(v), locale);
  }

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div><dt className="text-xs text-muted">{t('workbench.opening')}</dt><dd className="font-mono">{money(statement.opening)}</dd></div>
        <div><dt className="text-xs text-muted">{t('workbench.closing')}</dt><dd className="font-mono">{money(statement.closing)}</dd></div>
        <div>
          <dt className="text-xs text-muted">{t('workbench.gap')}</dt>
          <dd className={`font-mono ${gap === BigInt(0) ? '' : 'text-danger'}`}>{money(statement.gap)}</dd>
        </div>
        <div><dt className="text-xs text-muted">{t('workbench.toMatch')}</dt><dd className="font-mono">{unmatchedCount}</dd></div>
        <div className="flex items-end">
          {isOpen ? (
            <Button
              type="button"
              className="min-h-11 w-full"
              disabled={!canClose || pending}
              title={t('workbench.closeHint')}
              onClick={() => run(() => closeBankStatement({ id: statement.id }), () => t('workbench.closed'))}
            >
              {t('workbench.close')}
            </Button>
          ) : (
            <Badge>{t('state.done')}</Badge>
          )}
        </div>
      </dl>
      <p className="text-xs text-muted">{t('workbench.gapHint')}</p>
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${message.kind === 'error' ? 'text-danger' : ''}`}>
          {message.text}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">{t('workbench.bank')}</h2>
          <ul className="flex flex-col gap-2">
            {statement.lines.map((l) => {
              const isActive = active?.id === l.id;
              const amount = big(l.amount);
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(l.id)}
                    className={`flex w-full flex-col gap-1 rounded-2xl bg-surface-secondary p-3 text-start ${isActive ? 'ring-1 ring-primary' : ''}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm">{l.date} · {l.label}{l.reference ? ` · ${l.reference}` : ''}</span>
                      <span className={`font-mono text-sm ${amount < BigInt(0) ? 'text-danger' : ''}`}>{money(l.amount)}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted">
                      <Badge>{l.state === 'unmatched' ? t('workbench.toMatch') : l.state === 'matched' ? t('workbench.matchedTo') : t('workbench.ignore')}</Badge>
                      {l.matches.map((m) => m.entryNumber).join(', ')}
                      {l.state === 'unmatched' && proposalFor(statement.proposals[l.id]) && (
                        <span>{`${t('workbench.propose')} ${proposalFor(statement.proposals[l.id])}`}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {active && isOpen && active.state === 'unmatched' && (
            <div className="flex flex-col gap-3 rounded-2xl bg-surface-secondary p-3">
              {best && (
                <Button
                  type="button"
                  className="min-h-11"
                  disabled={pending}
                  onClick={() => run(() => matchStatementLine({ lineId: active.id, journalLineIds: best.journalLineIds }))}
                >
                  {`${t('workbench.confirm')} (${t('workbench.score')} ${best.score})`}
                </Button>
              )}
              {selected.size > 0 && (
                <p className="text-sm">
                  {t('workbench.selectedSum')}: <span className="font-mono">{money(selectedSum.toString())}</span>
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={pending || selected.size === 0}
                onClick={() => run(() => matchStatementLine({ lineId: active.id, journalLineIds: [...selected] }))}
              >
                {t('workbench.matchSelection')}
              </Button>

              <div className="flex flex-col gap-2 border-t pt-3">
                <Label htmlFor="counter-account">{t('workbench.counterAccount')}</Label>
                <select
                  id="counter-account"
                  className="text-sm"
                  value={counterId}
                  onChange={(e) => setCounterId(e.target.value)}
                >
                  {statement.counterAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{`${a.code} · ${a.name}`}</option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="min-h-11"
                    disabled={pending || !counterId}
                    onClick={() => run(() => createEntryFromLine({ lineId: active.id, counterAccountId: counterId }), (v) => t('workbench.createEntryDone', { number: v.number }))}
                  >
                    {t('workbench.createEntry')}
                  </Button>
                  <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={() => run(() => setStatementLineIgnored({ id: active.id, ignored: true }))}>
                    {t('workbench.ignore')}
                  </Button>
                </div>
              </div>
            </div>
          )}
          {active && isOpen && active.state === 'matched' && (
            <Button type="button" variant="outline" className="min-h-11 self-start" disabled={pending} onClick={() => run(() => unmatchStatementLine({ id: active.id }))}>
              {t('workbench.unmatch')}
            </Button>
          )}
          {active && isOpen && active.state === 'ignored' && (
            <Button type="button" variant="outline" className="min-h-11 self-start" disabled={pending} onClick={() => run(() => setStatementLineIgnored({ id: active.id, ignored: false }))}>
              {t('workbench.unignore')}
            </Button>
          )}

          {isOpen && (
            <form
              className="grid gap-3 rounded-2xl bg-surface-secondary p-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const label = String(f.get('label') ?? '').trim();
                const amount = String(f.get('workbench.amount') ?? '').trim();
                run(
                  () =>
                    addManualLine({
                      statementId: statement.id,
                      date: String(f.get('date') ?? ''),
                      label,
                      reference: String(f.get('reference') ?? '').trim() || null,
                      amount,
                      sign: f.get('sign') === 'out' ? 'out' : 'in',
                    }),
                  () => t('workbench.addLine'),
                );
                e.currentTarget.reset();
              }}
            >
              <h3 className="font-medium sm:col-span-2">{t('workbench.addLineTitle')}</h3>
              <div className="flex flex-col gap-1"><Label htmlFor="ml-date">{t('fields.date')}</Label><Input id="ml-date" name="date" type="date" required min={statement.dateFrom} defaultValue={statement.dateTo} /></div>
              <div className="flex flex-col gap-1"><Label htmlFor="ml-label">{t('fields.label')}</Label><Input id="ml-label" name="label" required maxLength={200} /></div>
              <div className="flex flex-col gap-1"><Label htmlFor="ml-ref">{t('fields.reference')}</Label><Input id="ml-ref" name="reference" maxLength={120} /></div>
              <div className="flex flex-col gap-1"><Label htmlFor="ml-amount">{t('workbench.amount')}</Label><Input id="ml-amount" name="amount" inputMode="decimal" required /></div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ml-sign">{t('workbench.in')} / {t('workbench.out')}</Label>
                <select id="ml-sign" name="sign" className="text-sm">
                  <option value="in">{t('workbench.in')}</option>
                  <option value="out">{t('workbench.out')}</option>
                </select>
              </div>
              <Button type="submit" className="min-h-11 self-end" disabled={pending}>{t('workbench.addLine')}</Button>
            </form>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-medium">{t('workbench.entries')}</h2>
          <Input
            aria-label={t('workbench.search')}
            placeholder={t('workbench.search')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="min-h-11"
          />
          {candidates.length === 0 ? (
            <p className="text-sm text-muted">{t('workbench.empty')}</p>
          ) : (
            <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pe-1">
              {candidates.map((c) => (
                <CandidateRow
                  key={c.journalLineId}
                  candidate={c}
                  money={money(c.value)}
                  proposed={proposedIds.has(c.journalLineId)}
                  checked={selected.has(c.journalLineId)}
                  disabled={!isOpen || !active || active.state !== 'unmatched'}
                  onToggle={(on) =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (on) next.add(c.journalLineId);
                      else next.delete(c.journalLineId);
                      return next;
                    })
                  }
                  score={proposals.find((p) => p.journalLineIds.includes(c.journalLineId))?.score}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );

  function proposalFor(ps: StatementDto['proposals'][string] | undefined): string {
    const p = ps?.[0];
    return p ? `${p.score}` : '';
  }
}

function CandidateRow({
  candidate,
  money,
  proposed,
  checked,
  disabled,
  onToggle,
  score,
}: {
  candidate: CandidateDto;
  money: string;
  proposed: boolean;
  checked: boolean;
  disabled: boolean;
  onToggle: (on: boolean) => void;
  score: number | undefined;
}) {
  const t = useTranslations('accounting.reconciliation');
  return (
    <li className={`flex items-start gap-3 rounded-2xl bg-surface-secondary p-3 ${proposed ? 'ring-1 ring-primary' : ''}`}>
      <input
        type="checkbox"
        className="mt-1 size-5"
        aria-label={`${candidate.entryNumber}`}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm">{candidate.entryNumber}</span>
          <span className="font-mono text-sm">{money}</span>
        </div>
        <span className="truncate text-xs text-muted">
          {candidate.date} · {candidate.lineLabel ?? candidate.entryRef ?? ''}
        </span>
        {score !== undefined && <span className="text-xs">{`${t('workbench.score')} ${score}`}</span>}
      </div>
    </li>
  );
}
