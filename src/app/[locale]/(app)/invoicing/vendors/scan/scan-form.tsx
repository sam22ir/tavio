'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { confirmVendorBillAction, scanVendorBillAction } from '@/modules/ai_features/ocr/actions';
import { errorKey } from '@/modules/ai_features/errors';

const INPUT = 'min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm';
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface Option { id: string; name: string }
interface Line { description: string; quantity: string; unitPrice: string; taxId: string; productId: string | null }
type OcrContentType = 'image/jpeg' | 'image/png' | 'image/webp';

export function ScanForm({ lookups, today }: {
  lookups: { partners: Option[]; taxes: (Option & { rate: string })[] };
  today: string;
}) {
  const t = useTranslations('ai_tools');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [file, setFile] = useState<{ name: string; type: OcrContentType; base64: string } | null>(null);
  const [supplierId, setSupplierId] = useState('');
  const [number, setNumber] = useState('');
  const [date, setDate] = useState(today);
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
      setSupplierId(res.value.supplierId ?? '');
      setNumber(res.value.number ?? '');
      if (res.value.date) setDate(res.value.date);
      setLines(res.value.lines.map((l) => ({
        description: l.description,
        quantity: String(l.quantity),
        unitPrice: String(l.unitPrice),
        taxId: l.taxId ?? '',
        productId: l.productId,
      })));
    });
  }

  function confirm() {
    if (!file || !lines || !supplierId) return;
    start(async () => {
      const res = await confirmVendorBillAction({
        partnerId: supplierId,
        date,
        origin: number || undefined,
        lines: lines.map((l) => ({ ...l, taxId: l.taxId || null })),
        fileName: file.name,
        contentType: file.type,
        dataBase64: file.base64,
      });
      if (!res.ok) { toast.error(t(errorKey(res.error.details))); return; }
      toast.success(t('scan.success'));
      router.push(`/invoicing/vendors/${res.value.invoiceId}`);
    });
  }

  function patchLine(i: number, patch: Partial<Line>) {
    setLines((cur) => cur?.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) ?? cur);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t('scan.hint')}</p>
        <input type="file" accept={TYPES.join(',')} capture="environment" onChange={(e) => pick(e.target.files?.[0])} className="text-sm" />
        {file ? <p className="text-sm">{file.name}</p> : null}
        <button type="button" disabled={!file || pending} onClick={scan} className="min-h-11 rounded-md bg-primary px-4 text-primary-foreground disabled:opacity-50">
          {pending && !lines ? t('scan.scanning') : t('scan.run')}
        </button>
      </section>

      {lines ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-medium">{t('scan.review')}</h2>
          <label className="flex flex-col gap-1 text-sm">
            {t('scan.supplier')}
            <select className={INPUT} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">—</option>
              {lookups.partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              {t('scan.number')}
              <input className={INPUT} value={number} onChange={(e) => setNumber(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t('scan.date')}
              <input type="date" className={INPUT} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
          {lines.map((l, i) => (
            <div key={i} className="grid gap-2 rounded-md border p-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
              <input className={INPUT} aria-label={t('scan.description')} value={l.description} onChange={(e) => patchLine(i, { description: e.target.value })} />
              <input className={INPUT} aria-label={t('scan.qty')} inputMode="decimal" value={l.quantity} onChange={(e) => patchLine(i, { quantity: e.target.value })} />
              <input className={INPUT} aria-label={t('scan.unitPrice')} inputMode="decimal" value={l.unitPrice} onChange={(e) => patchLine(i, { unitPrice: e.target.value })} />
              <select className={INPUT} aria-label={t('scan.tax')} value={l.taxId} onChange={(e) => patchLine(i, { taxId: e.target.value })}>
                <option value="">—</option>
                {lookups.taxes.map((tx) => <option key={tx.id} value={tx.id}>{tx.name}</option>)}
              </select>
            </div>
          ))}
          <button type="button" disabled={pending || !supplierId} onClick={confirm} className="min-h-11 rounded-md bg-primary px-4 text-primary-foreground disabled:opacity-50">
            {t('scan.confirm')}
          </button>
        </section>
      ) : null}
    </div>
  );
}
