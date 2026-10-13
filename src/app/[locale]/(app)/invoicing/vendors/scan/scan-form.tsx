'use client';

import { inputVariants } from '@heroui/styles';
import { cn } from '@/ui/lib/cn';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { checkVendorBillAction, confirmVendorBillAction, scanVendorBillAction } from '@/modules/ai_features/ocr/actions';
import { errorKey } from '@/modules/ai_features/errors';

const INPUT = cn(inputVariants({ variant: 'primary' }), 'min-h-11 w-full rounded-full px-4 text-sm');
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface Option { id: string; name: string }
interface Line { description: string; quantity: string; unitPrice: string; taxId: string; productId: string | null }
type OcrContentType = 'image/jpeg' | 'image/png' | 'image/webp';
type MatchedBy = 'nif' | 'nis' | 'rc' | 'article' | 'name';

interface PoCand { id: string; number: string; totalCents: number; diffCents: number | null; reason: 'reference' | 'amount'; lineDiffs: { lineIndex: number; orderedQty: number; scannedQty: number; orderedUnitCents: number; scannedUnitCents: number }[] }
interface DupHit { id: string; number: string | null; date: string; totalCents: number; reasons: ('origin' | 'purchase_order' | 'date_total')[] }

export function ScanForm({ lookups, today }: {
  lookups: { partners: Option[]; taxes: (Option & { rate: string })[] };
  today: string;
}) {
  const t = useTranslations('ai_tools');
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [file, setFile] = useState<{ name: string; type: OcrContentType; base64: string } | null>(null);
  const [supplierId, setSupplierId] = useState('');
  const [matchedBy, setMatchedBy] = useState<MatchedBy | null>(null);
  const [supplierCandidates, setSupplierCandidates] = useState<Option[]>([]);
  const [number, setNumber] = useState('');
  const [poReference, setPoReference] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [total, setTotal] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [poCandidates, setPoCandidates] = useState<PoCand[]>([]);
  const [poId, setPoId] = useState('');
  const [duplicates, setDuplicates] = useState<DupHit[]>([]);
  const [notDuplicate, setNotDuplicate] = useState(false);
  const [lines, setLines] = useState<Line[] | null>(null);

  function pick(f: File | undefined) {
    if (!f) return;
    if (!TYPES.includes(f.type)) return toast.error(t('scan.badType'));
    if (f.size > MAX_BYTES) return toast.error(t('scan.tooBig'));
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const base64 = url.slice(url.indexOf(',') + 1);
      setFile({ name: f.name, type: f.type as OcrContentType, base64 });
    };
    reader.readAsDataURL(f);
  }

  function scan() {
    if (!file) return;
    start(async () => {
      const res = await scanVendorBillAction({ contentType: file.type, dataBase64: file.base64 });
      if (!res.ok) { toast.error(t(errorKey(res.error.details))); return; }
      const v = res.value;
      setSupplierId(v.supplierId ?? '');
      setMatchedBy(v.supplierMatchedBy);
      setSupplierCandidates(v.supplierCandidates);
      setNumber(v.number ?? '');
      setPoReference(v.poReference);
      if (v.date) setDate(v.date);
      setTotal(v.total);
      setWarnings(v.warnings);
      setPoCandidates(v.poCandidates);
      setPoId('');
      setDuplicates(v.duplicates);
      setNotDuplicate(false);
      setLines(v.lines.map((l) => ({
        description: l.description,
        quantity: String(l.quantity),
        unitPrice: String(l.unitPrice),
        taxId: l.taxId ?? '',
        productId: l.productId,
      })));
    });
  }

  /** Re-runs the PO and duplicate checks for the chosen supplier. A PO no longer offered is cleared. */
  function refreshChecks(nextSupplier: string, nextNumber = number, nextDate = date) {
    if (!lines) return;
    start(async () => {
      const res = await checkVendorBillAction({
        supplierId: nextSupplier || null,
        number: nextNumber || null,
        poReference,
        date: nextDate || null,
        total,
        lines: lines
          .map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), taxRate: 0 }))
          .filter((l) => Number.isFinite(l.quantity) && l.quantity > 0 && Number.isFinite(l.unitPrice) && l.unitPrice >= 0),
      });
      if (!res.ok) { toast.error(t(errorKey(res.error.details))); return; }
      setPoCandidates(res.value.poCandidates);
      setDuplicates(res.value.duplicates);
      setNotDuplicate(false);
      if (!res.value.poCandidates.some((p) => p.id === poId)) setPoId('');
    });
  }

  function chooseSupplier(id: string) {
    setSupplierId(id);
    setMatchedBy(null);
    refreshChecks(id);
  }

  function confirm() {
    if (!file || !lines || !supplierId) return;
    if (duplicates.length > 0 && !notDuplicate) return;
    start(async () => {
      const res = await confirmVendorBillAction({
        partnerId: supplierId,
        date,
        origin: number || undefined,
        lines: lines.map((l) => ({ ...l, taxId: l.taxId || null })),
        fileName: file.name,
        contentType: file.type,
        dataBase64: file.base64,
        poId: poId || null,
        acknowledgeDuplicate: notDuplicate,
      });
      if (!res.ok) {
        toast.error(t(errorKey(res.error.details)));
        return;
      }
      toast.success(t('scan.success'));
      router.push(`/invoicing/vendors/${res.value.invoiceId}`);
    });
  }

  function patchLine(i: number, patch: Partial<Line>) {
    setLines((cur) => cur?.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) ?? cur);
  }

  const confirmBlocked = pending || !supplierId || (duplicates.length > 0 && !notDuplicate);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <p className="text-sm text-muted">{t('scan.hint')}</p>
        <input type="file" accept={TYPES.join(',')} capture="environment" onChange={(e) => pick(e.target.files?.[0])} className="text-sm" />
        {file ? <p className="text-sm">{file.name}</p> : null}
        <button type="button" disabled={!file || pending} onClick={scan} className="min-h-11 rounded-md bg-primary px-4 text-primary-foreground disabled:opacity-50">
          {pending && !lines ? t('scan.scanning') : t('scan.run')}
        </button>
      </section>

      {lines ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-medium">{t('scan.review')}</h2>

          {warnings.length > 0 ? (
            <ul role="status" className="flex flex-col gap-1 rounded-2xl bg-surface-secondary p-3 text-sm">
              {warnings.map((w) => <li key={w}>{t(`scan.warnings.${w}`)}</li>)}
            </ul>
          ) : null}

          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-sm">
              {t('scan.supplier')}
              <select className="min-h-11 w-full text-sm" value={supplierId} onChange={(e) => chooseSupplier(e.target.value)}>
                <option value="">—</option>
                {lookups.partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            {matchedBy ? <p className="text-xs text-muted">{t('scan.matchedBy', { by: t(`scan.matchKind.${matchedBy}`) })}</p> : null}
            {!supplierId && supplierCandidates.length > 0 ? (
              <div className="flex flex-col gap-2 rounded-2xl bg-surface-secondary p-3">
                <p className="text-sm">{t('scan.candidates')}</p>
                <div className="flex flex-wrap gap-2">
                  {supplierCandidates.map((c) => (
                    <button key={c.id} type="button" onClick={() => chooseSupplier(c.id)} className="min-h-11 rounded-full bg-surface px-4 text-sm">
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              {t('scan.number')}
              <input className={INPUT} value={number} onChange={(e) => setNumber(e.target.value)} onBlur={() => refreshChecks(supplierId, number, date)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t('scan.date')}
              <input type="date" className={INPUT} value={date} onChange={(e) => setDate(e.target.value)} onBlur={() => refreshChecks(supplierId, number, date)} />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            {t('scan.purchaseOrder')}
            <select className="min-h-11 w-full text-sm" value={poId} onChange={(e) => setPoId(e.target.value)} disabled={poCandidates.length === 0}>
              <option value="">{t('scan.noPurchaseOrder')}</option>
              {poCandidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.number}
                  {p.diffCents === null ? '' : ` · ${t('scan.diff', { amount: (p.diffCents / 100).toLocaleString(locale) })}`}
                  {p.reason === 'reference' ? ` · ${t('scan.byReference')}` : ''}
                </option>
              ))}
            </select>
          </label>
          {poId ? (
            <p role="note" className="text-xs text-muted">{t('scan.poNotice')}</p>
          ) : null}
          {poId ? (
            <ul className="flex flex-col gap-1 text-xs text-muted">
              {(poCandidates.find((p) => p.id === poId)?.lineDiffs ?? []).map((d) => (
                <li key={d.lineIndex}>
                  {t('scan.lineDiff', { line: d.lineIndex + 1, orderedQty: d.orderedQty, scannedQty: d.scannedQty, orderedUnit: (d.orderedUnitCents / 100).toLocaleString(locale), scannedUnit: (d.scannedUnitCents / 100).toLocaleString(locale) })}
                </li>
              ))}
            </ul>
          ) : null}

          {duplicates.length > 0 ? (
            <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-separator p-4">
              <p className="text-sm font-medium">{t('scan.duplicate.title')}</p>
              <ul className="flex flex-col gap-2 text-sm">
                {duplicates.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-2">
                    <Link href={`/${locale}/invoicing/vendors/${d.id}`} className="font-medium text-accent underline-offset-4 hover:underline">
                      {d.number ?? d.id.slice(0, 8)}
                    </Link>
                    <span className="text-muted">{d.date}</span>
                    <span>{(d.totalCents / 100).toLocaleString(locale)}</span>
                    <span className="text-xs text-muted">{d.reasons.map((r) => t(`scan.duplicate.reason.${r}`)).join(' · ')}</span>
                  </li>
                ))}
              </ul>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={notDuplicate} onChange={(e) => setNotDuplicate(e.target.checked)} className="size-5" />
                {t('scan.notDuplicate')}
              </label>
            </div>
          ) : null}

          {lines.map((l, i) => (
            <div key={i} className="grid gap-2 rounded-2xl bg-surface-secondary p-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
              <input className={INPUT} aria-label={t('scan.description')} value={l.description} onChange={(e) => patchLine(i, { description: e.target.value })} />
              <input className={INPUT} aria-label={t('scan.qty')} inputMode="decimal" value={l.quantity} onChange={(e) => patchLine(i, { quantity: e.target.value })} />
              <input className={INPUT} aria-label={t('scan.unitPrice')} inputMode="decimal" value={l.unitPrice} onChange={(e) => patchLine(i, { unitPrice: e.target.value })} />
              <select className="min-h-11 w-full text-sm" aria-label={t('scan.tax')} value={l.taxId} onChange={(e) => patchLine(i, { taxId: e.target.value })}>
                <option value="">—</option>
                {lookups.taxes.map((tx) => <option key={tx.id} value={tx.id}>{tx.name}</option>)}
              </select>
            </div>
          ))}
          <button type="button" disabled={confirmBlocked} onClick={confirm} className="min-h-11 rounded-md bg-primary px-4 text-primary-foreground disabled:opacity-50">
            {t('scan.confirm')}
          </button>
        </section>
      ) : null}
    </div>
  );
}
