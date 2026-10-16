'use client';

import { useActionState, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import type { FormState } from '@/core/entities/types';

export interface OrderFormOption { value: string; label: string }

export interface OrderFormProductOption extends OrderFormOption {
  name: string;
  costDzd: string;
}

export interface OrderFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  partners: OrderFormOption[];
  products: OrderFormProductOption[];
  taxes: OrderFormOption[];
}

interface LineDraft {
  productId: string;
  description: string;
  unitPrice: string;
}

const INITIAL_ROWS = 3;
const MAX_ROWS = 100;
const selectClass =
  'w-full text-sm focus-visible:outline-none focus-visible:ring-2';

// New purchase order. Lines are indexed line-0..line-N; the server skips empty rows.
export function OrderForm({ action, partners, products, taxes }: OrderFormProps) {
  const t = useTranslations('purchases');
  const tr = useTranslations();
  const [state, formAction, pending] = useActionState(action, {});
  const [rows, setRows] = useState(INITIAL_ROWS);
  const [lines, setLines] = useState<Record<number, LineDraft>>({});
  const fieldError = (key: string) => state.fieldErrors?.[key];

  useEffect(() => {
    if (state.message) toast.error(tr(state.message));
  }, [state, tr]);

  // Picking a product prefills the description (when empty or still the previous product name) and
  // the unit price from the product cost. The user can still edit both.
  const pickProduct = (i: number, productId: string) => {
    setLines((prev) => {
      const current = prev[i] ?? { productId: '', description: '', unitPrice: '' };
      const product = products.find((p) => p.value === productId);
      const previous = products.find((p) => p.value === current.productId);
      const replaceDescription = current.description === '' || current.description === previous?.name;
      return {
        ...prev,
        [i]: {
          productId,
          description: product && replaceDescription ? product.name : current.description,
          unitPrice: product ? product.costDzd : current.unitPrice,
        },
      };
    });
  };

  const lineDraft = (i: number): LineDraft => lines[i] ?? { productId: '', description: '', unitPrice: '' };
  const setLineField = (i: number, patch: Partial<LineDraft>) =>
    setLines((prev) => ({ ...prev, [i]: { ...lineDraft(i), ...prev[i], ...patch } }));

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="partnerId">{t('fields.partner')}</Label>
          <select id="partnerId" name="partnerId" required className={selectClass} defaultValue="">
            <option value="" disabled>
              {t('form.choose')}
            </option>
            {partners.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expectedDate">{t('fields.expectedDate')}</Label>
          <Input id="expectedDate" name="expectedDate" type="date" className="h-11" />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="note">{t('fields.note')}</Label>
          <Input id="note" name="note" className="h-11" />
        </div>
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-medium">{t('form.lines')}</legend>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="grid grid-cols-1 gap-3 rounded-2xl bg-surface-secondary p-3 sm:grid-cols-12">
            <div className="flex flex-col gap-1.5 sm:col-span-3">
              <Label htmlFor={`line-${i}-productId`}>{t('fields.product')}</Label>
              <select
                id={`line-${i}-productId`}
                name={`line-${i}-productId`}
                className={selectClass}
                value={lineDraft(i).productId}
                onChange={(e) => pickProduct(i, e.target.value)}
              >
                <option value="">{t('form.noProduct')}</option>
                {products.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-3">
              <Label htmlFor={`line-${i}-description`}>{t('fields.description')}</Label>
              <Input
                id={`line-${i}-description`}
                name={`line-${i}-description`}
                className="h-11"
                value={lineDraft(i).description}
                onChange={(e) => setLineField(i, { description: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor={`line-${i}-quantity`}>{t('fields.quantity')}</Label>
              <Input id={`line-${i}-quantity`} name={`line-${i}-quantity`} inputMode="decimal" className="h-11" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor={`line-${i}-unitPrice`}>{t('fields.unitPrice')}</Label>
              <Input
                id={`line-${i}-unitPrice`}
                name={`line-${i}-unitPrice`}
                inputMode="decimal"
                className="h-11"
                value={lineDraft(i).unitPrice}
                onChange={(e) => setLineField(i, { unitPrice: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor={`line-${i}-taxId`}>{t('fields.tax')}</Label>
              <select id={`line-${i}-taxId`} name={`line-${i}-taxId`} className={selectClass} defaultValue="">
                <option value="">{t('form.noTax')}</option>
                {taxes.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
        {rows < MAX_ROWS ? (
          <Button type="button" variant="outline" className="min-h-11 w-fit" onClick={() => setRows((n) => n + 1)}>
            {t('form.addLine')}
          </Button>
        ) : null}
      </fieldset>

      {state.message ? (
        <p role="alert" className="text-sm text-danger">
          {tr(state.message)}
        </p>
      ) : null}
      {fieldError('partnerId') ? (
        <p className="text-sm text-danger">{t('errors.validation')}</p>
      ) : null}

      <div>
        <Button type="submit" className="min-h-11" disabled={pending}>
          {t('order.new')}
        </Button>
      </div>
    </form>
  );
}
