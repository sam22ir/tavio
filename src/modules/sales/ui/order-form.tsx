'use client';

import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { createSaleOrderAction, updateSaleOrderAction } from '../actions';
import type { SaleLookups } from '../service/orders';

export type { OrderLineDraft, OrderFormInitial } from './order-form-defaults';
import { newLine, type OrderFormInitial, type OrderLineDraft } from './order-form-defaults';
import { textAreaVariants } from '@heroui/styles';
import { cn } from '@/ui/lib/cn';

const INPUT = 'min-h-11 w-full rounded-xl border border-separator bg-surface px-3 text-sm';

export function OrderForm({
  lookups,
  initial,
  today,
  locale,
}: {
  lookups: SaleLookups;
  initial: OrderFormInitial;
  today: string;
  locale: string;
}) {
  const t = useTranslations('sales');
  const router = useRouter();
  const [form, setForm] = useState<OrderFormInitial>({ ...initial, orderDate: initial.orderDate || today });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const setLine = (key: string, patch: Partial<OrderLineDraft>) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));

  const pickProduct = (key: string, productId: string) => {
    const product = lookups.products.find((p) => p.value === productId);
    setLine(key, {
      productId,
      description: product ? product.label : '',
      unitPrice: product ? product.unitPrice : '',
      taxId: product?.defaultTaxId ?? '',
    });
  };

  const submit = () => {
    setError(null);
    const payload = {
      partnerId: form.partnerId,
      orderDate: form.orderDate,
      validityDate: form.validityDate || null,
      note: form.note || null,
      lines: form.lines.map((l) => ({
        productId: l.productId || null,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount || '0',
        taxId: l.taxId || null,
      })),
    };
    startTransition(async () => {
      const result = form.id
        ? await updateSaleOrderAction({ ...payload, id: form.id })
        : await createSaleOrderAction(payload);
      if (!result.ok) {
        setError(errorText(result.error.code));
        toast.error(errorText(result.error.code));
        return;
      }
      router.push(`/${locale}/sales/${result.value.id}`);
    });
  };

  const errorText = (code: string): string => {
    if (code === 'VALIDATION') return t('errors.invalidAmount');
    if (code === 'POSTED_IMMUTABLE') return t('errors.notEditable');
    return t('errors.failed');
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
          {t('fields.partnerId')}
          <select
            required
            className={INPUT}
            value={form.partnerId}
            onChange={(e) => setForm((f) => ({ ...f, partnerId: e.target.value }))}
          >
            <option value="" />
            {lookups.partners.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('fields.orderDate')}
          <input
            type="date"
            required
            className={INPUT}
            value={form.orderDate}
            onChange={(e) => setForm((f) => ({ ...f, orderDate: e.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('fields.validityDate')}
          <input
            type="date"
            className={INPUT}
            value={form.validityDate}
            onChange={(e) => setForm((f) => ({ ...f, validityDate: e.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          {t('fields.note')}
          <textarea
            className={cn(textAreaVariants({ variant: 'primary' }), 'min-h-11 w-full rounded-2xl px-4 py-2 text-sm')}
            rows={2}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        {form.lines.map((line, index) => (
          <fieldset key={line.key} className="grid gap-2 rounded-2xl bg-surface-secondary p-3 sm:grid-cols-12">
            <legend className="px-1 text-xs text-muted">#{index + 1}</legend>
            <label className="flex flex-col gap-1 text-sm sm:col-span-4">
              {t('fields.product')}
              <select className={INPUT} value={line.productId} onChange={(e) => pickProduct(line.key, e.target.value)}>
                <option value="">{t('hint.noProduct')}</option>
                {lookups.products.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-4">
              {t('fields.description')}
              <input
                required
                className={INPUT}
                value={line.description}
                onChange={(e) => setLine(line.key, { description: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              {t('fields.quantity')}
              <input
                required
                inputMode="decimal"
                className={INPUT}
                value={line.quantity}
                onChange={(e) => setLine(line.key, { quantity: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-3">
              {t('fields.unitPrice')}
              <input
                required
                inputMode="decimal"
                className={INPUT}
                value={line.unitPrice}
                onChange={(e) => setLine(line.key, { unitPrice: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              {t('fields.discount')}
              <input
                inputMode="decimal"
                className={INPUT}
                value={line.discount}
                onChange={(e) => setLine(line.key, { discount: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-3">
              {t('fields.tax')}
              <select className={INPUT} value={line.taxId} onChange={(e) => setLine(line.key, { taxId: e.target.value })}>
                <option value="" />
                {lookups.taxes.map((tx) => (
                  <option key={tx.value} value={tx.value}>
                    {tx.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end sm:col-span-12">
              <button
                type="button"
                className="min-h-11 min-w-11 rounded-md px-3 text-sm text-danger underline"
                onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((l) => l.key !== line.key) }))}
                disabled={form.lines.length === 1}
              >
                {t('actions.removeLine')}
              </button>
            </div>
          </fieldset>
        ))}
        <button
          type="button"
          className="min-h-11 w-full rounded-2xl border border-separator border-dashed text-sm sm:w-auto sm:px-4"
          onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, newLine()] }))}
        >
          {t('actions.addLine')}
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50 sm:w-auto"
        >
          {t('actions.save')}
        </button>
      </div>
    </form>
  );
}

