'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import { BANK_IMPORT_FIELDS } from '../service/reconciliation';
import type { ColumnMapping } from '../service/reconciliation';
import { importBankStatement, previewBankCsvAction, type BankCsvPreview } from '../reconciliation-actions';
import { messageKeyOf } from './reconciliation-dto';

export interface StatementAccountOption {
  id: string;
  code: string;
  name: string;
}

/** Server keys are 'reconciliation.errors.x'; this component's translator is already scoped to 'accounting.reconciliation'. */
export function scopedKey(key: string | undefined, fallback: string): string {
  return key ? key.replace(/^reconciliation\./, '') : fallback;
}

const MAPPABLE = BANK_IMPORT_FIELDS.map((f) => f.key) as (keyof ColumnMapping)[];

/** Two steps: pick the file and check the column mapping on a preview, then import. Nothing is stored until import. */
export function BankStatementImport({ accounts }: { accounts: StatementAccountOption[] }) {
  const t = useTranslations('accounting.reconciliation');
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState<string | null>(null);
  const [preview, setPreview] = useState<BankCsvPreview | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    setMessage(null);
    if (!file) return;
    const body = await file.text();
    const res = await previewBankCsvAction(body);
    if (!res.ok) {
      setText(null);
      setPreview(null);
      setMessage(t(scopedKey(messageKeyOf(res.error), 'errors.file')));
      return;
    }
    setText(body);
    setPreview(res.value);
    setMapping(res.value.mapping);
  }

  function setField(key: keyof ColumnMapping, value: string) {
    if (!mapping) return;
    setMapping({ ...mapping, [key]: value === '' ? null : Number(value) });
  }

  function onImport(formData: FormData) {
    if (!text || !mapping) return;
    setMessage(null);
    startTransition(async () => {
      const res = await importBankStatement({
        text,
        mapping,
        accountId: String(formData.get('accountId') ?? ''),
        name: String(formData.get('name') ?? ''),
        openingText: String(formData.get('opening') ?? ''),
        closingText: String(formData.get('closing') ?? ''),
      });
      if (!res.ok) {
        setMessage(t(scopedKey(messageKeyOf(res.error), res.error.code)));
        return;
      }
      router.push(`/${locale}/accounting/reconciliation/${res.value.id}`);
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <h2 className="font-medium">{t('importTitle')}</h2>
      <div className="flex flex-col gap-2">
        <Label htmlFor="bank-csv">{t('file')}</Label>
        <Input id="bank-csv" type="file" accept=".csv,text/csv" onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>

      {preview && mapping && (
        <form action={onImport} className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t('rows', { count: preview.rowCount })}</p>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-medium">{t('mappingTitle')}</legend>
            {MAPPABLE.map((key) => (
              <div key={key} className="flex flex-col gap-1">
                <Label htmlFor={`map-${key}`}>{t(`fields.${key}`)}</Label>
                <select
                  id={`map-${key}`}
                  className="h-11 rounded-md border bg-background px-3 text-sm"
                  value={mapping[key] === null ? '' : String(mapping[key])}
                  onChange={(e) => setField(key, e.target.value)}
                >
                  <option value="">{t('noMapping')}</option>
                  {preview.headers.map((h, i) => (
                    <option key={`${h}-${i}`} value={String(i)}>{h || `#${i + 1}`}</option>
                  ))}
                </select>
              </div>
            ))}
          </fieldset>

          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-default/50">
                  {preview.headers.map((h, i) => (
                    <th key={`${h}-${i}`} className="px-2 py-1 text-start font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.sample.map((row, r) => (
                  <tr key={r} className="border-t">
                    {preview.headers.map((_, i) => (
                      <td key={i} className="px-2 py-1">{row[i] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="stmt-account">{t('account')}</Label>
              <select id="stmt-account" name="accountId" required className="h-11 rounded-md border bg-background px-3 text-sm">
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{`${a.code} · ${a.name}`}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="stmt-name">{t('name')}</Label>
              <Input id="stmt-name" name="name" required maxLength={120} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="stmt-opening">{t('opening')}</Label>
              <Input id="stmt-opening" name="opening" inputMode="decimal" required />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="stmt-closing">{t('closing')}</Label>
              <Input id="stmt-closing" name="closing" inputMode="decimal" required />
            </div>
          </div>
          <div>
            <Button type="submit" disabled={pending} className="min-h-11">
              {pending ? t('importing') : t('importButton')}
            </Button>
          </div>
        </form>
      )}
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
    </section>
  );
}
