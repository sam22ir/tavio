'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  autoMapColumns, decodeText, missingRequired, parseCsv, toCsv,
  type ImportField, type ImportMapping, type IoColumn,
} from '@/core/io';
import { buttonVariants } from '@/ui/primitives/button';
import { cn } from '@/ui/lib/cn';
import { importBatch, previewImport, type BatchError, type PreviewRow } from '../_lib/actions';

const BATCH_ROWS = 200;
const MAX_ROWS = 10000;
const MAX_BYTES = 5 * 1024 * 1024;

type Stage = 'pick' | 'map' | 'preview' | 'running' | 'done';

interface Props {
  entityName: string;
  fields: ImportField[];
  duplicateRule: string;
  backHref: string;
}

interface Totals {
  created: number;
  skipped: number;
  errors: BatchError[];
}

export function ImportWizard({ entityName, fields, duplicateRule, backHref }: Props) {
  const t = useTranslations('io.import');
  const [stage, setStage] = useState<Stage>('pick');
  const [error, setError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [separator, setSeparator] = useState<string>(',');
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [totals, setTotals] = useState<Totals>({ created: 0, skipped: 0, errors: [] });

  const reset = () => {
    setStage('pick');
    setError(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setPreview([]);
    setTotals({ created: 0, skipped: 0, errors: [] });
  };

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      setError(t('excel_unsupported'));
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(t('too_many', { max: MAX_ROWS }));
      return;
    }
    const text = decodeText(new Uint8Array(await file.arrayBuffer()));
    const parsed = parseCsv(text);
    if (parsed.records.length < 2) {
      setError(t('parse_error'));
      return;
    }
    const dataRows = parsed.records.slice(1);
    if (dataRows.length > MAX_ROWS) {
      setError(t('too_many', { max: MAX_ROWS }));
      return;
    }
    const head = parsed.records[0] ?? [];
    setSeparator(parsed.separator);
    setHeaders(head);
    setRows(dataRows);
    setMapping(autoMapColumns(head, fields));
    setStage('map');
  }

  const missing = missingRequired(mapping, fields);

  async function onPreview() {
    setError(null);
    const result = await previewImport({
      entity: entityName,
      mapping,
      rows: rows.slice(0, 20),
      total: rows.length,
    });
    if (!result.ok) {
      setError(t('failed'));
      return;
    }
    setPreview(result.value.rows);
    setStage('preview');
  }

  async function onConfirm() {
    setError(null);
    setStage('running');
    const total = rows.length;
    const acc: Totals = { created: 0, skipped: 0, errors: [] };
    setProgress({ done: 0, total });
    for (let offset = 0; offset < total; offset += BATCH_ROWS) {
      const batch = rows.slice(offset, offset + BATCH_ROWS);
      const result = await importBatch({ entity: entityName, mapping, rows: batch, offset });
      if (!result.ok) {
        setError(t('failed'));
        setTotals(acc);
        setStage('done');
        return;
      }
      acc.created += result.value.created;
      acc.skipped += result.value.skipped;
      acc.errors.push(...result.value.errors);
      setProgress({ done: Math.min(offset + BATCH_ROWS, total), total });
    }
    setTotals(acc);
    setStage('done');
  }

  function downloadErrors() {
    const columns: IoColumn[] = [
      ...headers.map((h, i) => ({ key: `c${i}`, header: h || `#${i + 1}` })),
      { key: 'error', header: t('error_column') },
    ];
    const data = totals.errors.map((e) => {
      const record = rows[e.index] ?? [];
      const row: Record<string, string> = { error: e.messages.join('; ') };
      headers.forEach((_, i) => {
        row[`c${i}`] = record[i] ?? '';
      });
      return row;
    });
    const bytes = toCsv(data, columns, { separator: separator === ';' ? ';' : ',' });
    const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `import-${entityName}-errors.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const mappedLabel = (key: string) => fields.find((f) => f.key === key)?.label ?? key;

  return (
    <section className="flex flex-col gap-6">
      {error ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {stage === 'pick' && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">{t('pick')}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => onFile(e.target.files?.[0])}
              className="file:me-3 file:rounded-md file:border file:px-3 file:py-2"
            />
          </label>
        </div>
      )}

      {stage === 'map' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {t('rows_count', { count: rows.length })} · {t('detected_separator', { sep: separator === '\t' ? 'TAB' : separator })}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <label key={f.key} className="flex flex-col gap-1 text-sm">
                <span className="font-medium">
                  {f.label}
                  {f.required ? ' *' : ''}
                </span>
                <select
                  className="rounded-md border bg-background p-2"
                  value={mapping[f.key] ?? ''}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [f.key]: e.target.value === '' ? null : Number(e.target.value) }))
                  }
                >
                  <option value="">{t('field_ignore')}</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `#${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {missing.length > 0 ? (
            <p className="text-sm text-destructive">
              {t('required_missing', { fields: missing.map(mappedLabel).join(', ') })}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button type="button" className={buttonVariants({ variant: 'outline' })} onClick={reset}>
              {t('restart')}
            </button>
            <button
              type="button"
              className={buttonVariants()}
              disabled={missing.length > 0}
              onClick={onPreview}
            >
              {t('preview_btn')}
            </button>
          </div>
        </div>
      )}

      {stage === 'preview' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium">{t('preview')}</p>
          <p className="text-sm text-muted-foreground">{duplicateRule}</p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">{t('line')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('status_ok')}</th>
                  <th className="px-3 py-2 text-start font-medium">{fields[0]?.label ?? ''}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('errors')}</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p) => (
                  <tr key={p.line} className="border-t">
                    <td className="px-3 py-2 tabular-nums">{p.line}</td>
                    <td className={cn('px-3 py-2', p.status === 'error' && 'text-destructive')}>
                      {p.status === 'ok' ? t('status_ok') : p.status === 'duplicate' ? t('status_duplicate') : t('status_error')}
                    </td>
                    <td className="px-3 py-2">{p.values[0] ?? ''}</td>
                    <td className="px-3 py-2 text-destructive">{p.messages.join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button type="button" className={buttonVariants({ variant: 'outline' })} onClick={() => setStage('map')}>
              {t('back')}
            </button>
            <button type="button" className={buttonVariants()} onClick={onConfirm}>
              {t('confirm', { count: rows.length })}
            </button>
          </div>
        </div>
      )}

      {stage === 'running' && (
        <p className="text-sm" aria-live="polite">
          {t('running', { done: progress.done, total: progress.total })}
        </p>
      )}

      {stage === 'done' && (
        <div className="flex flex-col gap-4">
          <dl className="grid max-w-md grid-cols-3 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <dt className="text-muted-foreground">{t('created')}</dt>
              <dd className="text-lg font-semibold tabular-nums">{totals.created}</dd>
            </div>
            <div className="rounded-md border p-3">
              <dt className="text-muted-foreground">{t('skipped')}</dt>
              <dd className="text-lg font-semibold tabular-nums">{totals.skipped}</dd>
            </div>
            <div className="rounded-md border p-3">
              <dt className="text-muted-foreground">{t('errors')}</dt>
              <dd className="text-lg font-semibold tabular-nums">{totals.errors.length}</dd>
            </div>
          </dl>
          <p className="text-sm text-muted-foreground">{duplicateRule}</p>
          <div className="flex flex-wrap gap-2">
            {totals.errors.length > 0 ? (
              <button type="button" className={buttonVariants({ variant: 'outline' })} onClick={downloadErrors}>
                {t('download_errors')}
              </button>
            ) : null}
            <button type="button" className={buttonVariants({ variant: 'outline' })} onClick={reset}>
              {t('restart')}
            </button>
            <a href={backHref} className={buttonVariants()}>
              {t('back')}
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
