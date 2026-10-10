'use client';

import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { createDraftAction, updateDraftAction } from '../actions';
import { centsToDzdText, formatPreview, newDraftLine, previewDraftTotals, type DraftFormInitial, type DraftLineDraft, type DraftLookups } from './draft-form-defaults';

const INPUT = 'min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm';
const KNOWN_ERRORS = ['VALIDATION', 'NOT_FOUND', 'FORBIDDEN', 'STATE', 'POSTED_IMMUTABLE'] as const;

export function DraftForm({
  kind,
  locale,
  lookups,
  initial,
}: {
  kind: 'customers' | 'vendors';
  locale: string;
  lookups: DraftLookups;
  initial: DraftFormInitial;
}) {
  const t = useTranslations('invoicing');
  const router = useRouter();
  const [form, setForm] = useState<DraftFormInitial>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const taxRateById = useMemo(() => new Map(lookups.taxes.map((x) => [x.value, x.rate])), [lookups.taxes]);
  // Retenue à la source applies to vendor bills only. ⚠ needs accountant verification
  const withholdingRate = lookups.withholdingTaxes.find((x) => x.value === form.withholdingTaxId)?.rate ?? '0';
  const totals = useMemo(
    () => previewDraftTotals(form.lines, taxRateById, kind === 'vendors' ? withholdingRate : '0'),
    [form.lines, taxRateById, kind, withholdingRate],
  );

  const setLine = (key: string, patch: Partial<DraftLineDraft>) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));

  const pickProduct = (key: string, productId: string) => {
    const product = lookups.products.find((p) => p.value === productId);
    setLine(key, {
      productId,
      description: product ? product.label : '',
      unitPrice: product ? centsToDzdText(BigInt(product.unitPrice)) : '',
      taxId: product?.defaultTaxId ?? '',
    });
  };

  const submit = () => {
    setError(null);
    const payload = {
      type: kind === 'customers' ? ('out_invoice' as const) : ('in_invoice' as const),
      partnerId: form.partnerId,
      date: form.date,
      dueDate: form.dueDate || undefined,
      withholdingTaxId: kind === 'vendors' ? form.withholdingTaxId || null : null,
      lines: form.lines.map((l) => ({
        productId: l.productId || null,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount,
        taxId: l.taxId || null,
      })),
    };
    startTransition(async () => {
      const result = form.id
        ? await updateDraftAction({ ...payload, id: form.id })
        : await createDraftAction(payload);
      if (!result.ok) {
        const code = (KNOWN_ERRORS as readonly string[]).includes(result.error.code) ? result.error.code : 'INTERNAL';
        setError(t(`error.${code}` as never));
        toast.error(t(`error.${code}` as never));
        return;
      }
      router.push(`/${locale}/invoicing/${kind}/${result.value.id}`);
    });
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          {t('form.partner')}
          <select required className={INPUT} value={form.partnerId} onChange={(e) => setForm((f) => ({ ...f, partnerId: e.target.value }))}>
            <option value="" />
            {lookups.partners.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('form.date')}
          <input type="date" required className={INPUT} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('form.dueDate')}
          <input type="date" className={INPUT} value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        {form.lines.map((line, index) => (
          <fieldset key={line.key} className="grid gap-2 rounded-md border p-3 sm:grid-cols-12">
            <legend className="px-1 text-xs text-muted-foreground">{t('editor.line', { n: index + 1 })}</legend>
            <label className="flex flex-col gap-1 text-sm sm:col-span-4">
              {t('editor.product')}
              <select className={INPUT} value={line.productId} onChange={(e) => pickProduct(line.key, e.target.value)}>
                <option value="">{t('editor.noProduct')}</option>
                {lookups.products.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-4">
              {t('form.description')}
              <input required maxLength={300} className={INPUT} value={line.description} onChange={(e) => setLine(line.key, { description: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              {t('form.quantity')}
              <input required inputMode="decimal" className={INPUT} value={line.quantity} onChange={(e) => setLine(line.key, { quantity: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              {t('form.discount')}
              <input inputMode="decimal" className={INPUT} value={line.discount} onChange={(e) => setLine(line.key, { discount: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-4">
              {t('form.unitPrice')}
              <input required inputMode="decimal" className={INPUT} value={line.unitPrice} onChange={(e) => setLine(line.key, { unitPrice: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              {t('form.tax')}
              <select className={INPUT} value={line.taxId} onChange={(e) => setLine(line.key, { taxId: e.target.value })}>
                <option value="">{t('form.noTax')}</option>
                {lookups.taxes.map((tx) => (
                  <option key={tx.value} value={tx.value}>{tx.label}</option>
                ))}
              </select>
            </label>
            <div className="flex items-end sm:col-span-12">
              <button
                type="button"
                className="min-h-11 min-w-11 rounded-md px-3 text-sm text-destructive underline"
                disabled={form.lines.length === 1}
                onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((l) => l.key !== line.key) }))}
              >
                {t('editor.removeLine')}
              </button>
            </div>
          </fieldset>
        ))}
        <button
          type="button"
          className="min-h-11 w-full rounded-md border border-dashed text-sm sm:w-auto sm:px-4"
          onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, newDraftLine()] }))}
        >
          {t('editor.addLine')}
        </button>
      </div>

      {kind === 'vendors' && lookups.withholdingTaxes.length > 0 ? (
        <label className="flex max-w-sm flex-col gap-1 text-sm">
          {t('form.withholding')}
          <select className={INPUT} value={form.withholdingTaxId ?? ''} onChange={(e) => setForm((f) => ({ ...f, withholdingTaxId: e.target.value }))}>
            <option value="">{t('form.noWithholding')}</option>
            {lookups.withholdingTaxes.map((tx) => (
              <option key={tx.value} value={tx.value}>{tx.label}</option>
            ))}
          </select>
        </label>
      ) : null}

      <dl className="grid max-w-sm grid-cols-2 gap-1 text-sm">
        <dt>{t('editor.untaxed')}</dt><dd className="text-end">{formatPreview(totals.untaxedCents, locale)}</dd>
        <dt>{t('editor.tax')}</dt><dd className="text-end">{formatPreview(totals.taxCents, locale)}</dd>
        <dt className="font-semibold">{t('editor.total')}</dt><dd className="text-end font-semibold">{formatPreview(totals.totalCents, locale)}</dd>
        {totals.withholdingCents > BigInt(0) ? (
          <>
            <dt>{t('editor.withholding')}</dt><dd className="text-end">{formatPreview(totals.withholdingCents, locale)}</dd>
            <dt className="font-semibold">{t('editor.netPayable')}</dt><dd className="text-end font-semibold">{formatPreview(totals.netPayableCents, locale)}</dd>
          </>
        ) : null}
      </dl>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50 sm:w-auto"
        >
          {form.id ? t('editor.save') : t('form.submit')}
        </button>
      </div>
    </form>
  );
}
