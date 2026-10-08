'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import { applyRate, formatDzd, parseDzd, roundHalfUp, type Cents } from '@/core/money';
import type { Locale } from '@/core/ctx';
import { buildSchedule, type ScheduleLine } from '../service/schedule';
import { createDraft, updateDraft } from '../actions/contracts';
import { SchedulePreview } from './schedule-preview';

export interface PartnerOption { value: string; label: string }
export interface ProductOption { value: string; label: string; unitPriceCents: string }

interface LineState { key: number; productId: string; description: string; quantity: string; price: string }

export interface ContractFormInitial {
  id?: string;
  partnerId?: string;
  downPayment?: string;
  markupRate?: string;
  installmentsCount?: number;
  frequency?: 'monthly' | 'weekly';
  startDate?: string;
  notes?: string;
  lines?: { productId?: string; description: string; quantity: string; unitPriceCents: string }[];
}

interface Props {
  partners: PartnerOption[];
  products: ProductOption[];
  initial?: ContractFormInitial;
}

const QTY_RE = /^\d+(\.\d{1,3})?$/;

/** Quantity as thousandths (bigint), e.g. "1.5" -> 1500n. */
function qtyMilli(q: string): bigint {
  if (!QTY_RE.test(q)) return 0n;
  const [whole, frac = ''] = q.split('.');
  return BigInt(whole as string) * 1000n + BigInt(frac.padEnd(3, '0'));
}

export function ContractForm({ partners, products, initial }: Props) {
  const t = useTranslations('credit');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  let nextKey = 1;

  const [partnerId, setPartnerId] = useState(initial?.partnerId ?? '');
  const [lines, setLines] = useState<LineState[]>(
    initial?.lines?.length
      ? initial.lines.map((l) => ({
          key: nextKey++,
          productId: l.productId ?? '',
          description: l.description,
          quantity: l.quantity,
          price: l.unitPriceCents,
        }))
      : [{ key: nextKey++, productId: '', description: '', quantity: '1', price: '' }],
  );
  const [downPayment, setDownPayment] = useState(initial?.downPayment ?? '');
  const [markupRate, setMarkupRate] = useState(initial?.markupRate ?? '0');
  const [count, setCount] = useState(String(initial?.installmentsCount ?? 12));
  const [frequency, setFrequency] = useState<'monthly' | 'weekly'>(initial?.frequency ?? 'monthly');
  const [startDate, setStartDate] = useState(initial?.startDate ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const productById = useMemo(() => new Map(products.map((p) => [p.value, p])), [products]);

  function updateLine(key: number, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function pickProduct(key: number, productId: string) {
    const p = productById.get(productId);
    const c = p ? BigInt(p.unitPriceCents) : null;
    const unit = c === null ? '' : `${c / 100n}.${(c % 100n).toString().padStart(2, '0')}`;
    updateLine(key, {
      productId,
      description: p?.label ?? '',
      price: unit,
    });
  }

  // Money totals computed client-side for preview. The server recomputes everything on save.
  const totals = useMemo(() => {
    let cash = 0n;
    for (const l of lines) {
      const unit = parseDzd(l.price);
      const q = qtyMilli(l.quantity);
      if (unit === null || q === 0n) continue;
      cash += roundHalfUp(unit * q, 1000n);
    }
    const down = parseDzd(downPayment) ?? 0n;
    // Same formula as service/contracts.ts: markup is charged on the price net of the down payment.
    const markup = /^\d+(\.\d{1,4})?$/.test(markupRate) ? applyRate(cash - down, markupRate) : 0n;
    const total = cash + markup;
    const financed = cash - down + markup;
    return { cash, markup, total, down, financed };
  }, [lines, markupRate, downPayment]);

  const schedule: ScheduleLine[] = useMemo(() => {
    const n = Number(count);
    if (!startDate || !Number.isInteger(n) || n < 1 || totals.financed <= 0n) return [];
    try {
      return buildSchedule({ financedCents: totals.financed, count: n, frequency, firstDueDate: startDate });
    } catch {
      return [];
    }
  }, [totals.financed, count, frequency, startDate]);

  function buildPayload() {
    const parsedLines = lines.map((l) => ({
      productId: l.productId || undefined,
      description: l.description,
      quantity: l.quantity,
      unitPriceCents: (parseDzd(l.price) ?? 0n).toString(),
    }));
    return {
      partnerId,
      lines: parsedLines,
      downPaymentCents: (parseDzd(downPayment) ?? 0n).toString(),
      markupRate,
      installmentsCount: Number(count),
      frequency,
      startDate,
      notes: notes || undefined,
    };
  }

  function save() {
    setError(null);
    if (!partnerId) return setError(t('contract.form.errors.partner'));
    if (lines.some((l) => !l.description.trim() || parseDzd(l.price) === null || !QTY_RE.test(l.quantity))) {
      return setError(t('contract.form.errors.lines'));
    }
    if (parseDzd(downPayment) === null && downPayment !== '') return setError(t('contract.form.errors.down'));
    if (!startDate) return setError(t('contract.form.errors.date'));

    startTransition(async () => {
      const payload = buildPayload();
      const res = initial?.id ? await updateDraft({ ...payload, id: initial.id }) : await createDraft(payload);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      toast.success(t('contract.form.saved'));
      router.push(`/${locale}/credit/contracts/${res.value.id}`);
    });
  }

  const fmt = (c: Cents) => formatDzd(c, locale);

  return (
    <form
      className="grid gap-6 lg:grid-cols-[1fr_320px]"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <Label htmlFor="partnerId">{t('fields.partnerId')}</Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              id="partnerId"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              required
            >
              <option value="">{t('contract.form.choosePartner')}</option>
              {partners.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <Link href={`/${locale}/contacts/new`} className="text-sm underline whitespace-nowrap">
              {t('contract.form.createPartner')}
            </Link>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-medium">{t('contract.form.lines')}</h2>
          {lines.map((l) => (
            <div key={l.key} className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-12">
              <select
                aria-label={t('contract.form.product')}
                className="h-11 rounded-md border bg-background px-2 text-sm sm:col-span-3 sm:h-9"
                value={l.productId}
                onChange={(e) => pickProduct(l.key, e.target.value)}
              >
                <option value="">{t('contract.form.noProduct')}</option>
                {products.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <Input
                aria-label={t('contract.form.description')}
                className="h-11 sm:col-span-5 sm:h-9"
                value={l.description}
                onChange={(e) => updateLine(l.key, { description: e.target.value })}
              />
              <Input
                aria-label={t('contract.form.qty')}
                inputMode="decimal"
                className="h-11 sm:col-span-2 sm:h-9"
                value={l.quantity}
                onChange={(e) => updateLine(l.key, { quantity: e.target.value })}
              />
              <Input
                aria-label={t('contract.form.price')}
                inputMode="decimal"
                className="h-11 tabular-nums sm:col-span-2 sm:h-9"
                value={l.price}
                onChange={(e) => updateLine(l.key, { price: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 sm:col-span-12 sm:justify-self-end"
                disabled={lines.length === 1}
                onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
              >
                {t('contract.form.removeLine')}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() => setLines((prev) => [...prev, { key: Date.now(), productId: '', description: '', quantity: '1', price: '' }])}
          >
            {t('contract.form.addLine')}
          </Button>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="downPayment">{t('fields.downPaymentCents')}</Label>
            <Input id="downPayment" inputMode="decimal" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="markupRate">{t('fields.markupRate')}</Label>
            <Input id="markupRate" inputMode="decimal" value={markupRate} onChange={(e) => setMarkupRate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="count">{t('fields.installmentsCount')}</Label>
            <Input id="count" type="number" min={1} max={120} value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="frequency">{t('fields.frequency')}</Label>
            <select
              id="frequency"
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as 'monthly' | 'weekly')}
            >
              <option value="monthly">{t('options.frequency.monthly')}</option>
              <option value="weekly">{t('options.frequency.weekly')}</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="startDate">{t('contract.form.firstDue')}</Label>
            <Input id="startDate" type="date" dir="ltr" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="notes">{t('fields.notes')}</Label>
            <textarea
              id="notes"
              className="min-h-20 rounded-md border bg-background p-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </section>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>{t('contract.form.saveDraft')}</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>{t('contract.form.cancel')}</Button>
        </div>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-md border p-4 text-sm">
          <dl className="grid grid-cols-2 gap-y-2">
            <dt>{t('contract.form.cash')}</dt><dd className="text-end tabular-nums">{fmt(totals.cash)}</dd>
            <dt>{t('fields.markupCents')}</dt><dd className="text-end tabular-nums">{fmt(totals.markup)}</dd>
            <dt>{t('fields.totalCents')}</dt><dd className="text-end font-medium tabular-nums">{fmt(totals.total)}</dd>
            <dt>{t('fields.downPaymentCents')}</dt><dd className="text-end tabular-nums">{fmt(totals.down)}</dd>
            <dt>{t('fields.financedCents')}</dt><dd className="text-end font-medium tabular-nums">{fmt(totals.financed)}</dd>
          </dl>
        </div>
        <h2 className="font-medium">{t('contract.form.preview')}</h2>
        <SchedulePreview
          lines={schedule}
          locale={locale}
          labels={{
            seq: t('contract.form.seq'),
            dueDate: t('fields.startDate'),
            amount: t('fields.amountCents'),
            empty: t('contract.form.previewEmpty'),
          }}
        />
      </aside>
    </form>
  );
}
