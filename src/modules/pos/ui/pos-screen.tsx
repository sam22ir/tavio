'use client';

import { useMemo, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatDzd, parseDzd, type Cents } from '@/core/money';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { payOrderAct, type WirePaidOrder } from '../actions';
import { changeDue, lineAmounts, orderTotals } from '../service/totals';
import { CloseSessionDialog } from './close-session-dialog';

export interface PosProduct {
  id: string;
  name: string;
  priceCents: string;
  taxRate: string;
}

type PayMethod = 'cash' | 'cib' | 'edahabia';

interface Receipt {
  number: string;
  method: PayMethod;
  totalCents: Cents;
  changeCents: Cents | null;
  lines: { name: string; count: number; lineCents: Cents }[];
}

const MILLI_PER_UNIT = BigInt(1000);

/** Maps a service error message to a translation key. Messages are codes, never shown raw. */
function errorKey(message: string): 'insufficient' | 'invalid' | 'closed' | 'alreadyOpen' | 'failed' {
  switch (message) {
    case 'INSUFFICIENT_TENDER':
      return 'insufficient';
    case 'INVALID_AMOUNT':
    case 'INVALID_QUANTITY':
      return 'invalid';
    case 'SESSION_NOT_OPEN':
      return 'closed';
    case 'SESSION_ALREADY_OPEN':
      return 'alreadyOpen';
    default:
      return 'failed';
  }
}

export function PosScreen({
  sessionId,
  products,
}: {
  sessionId: string;
  products: PosProduct[];
}) {
  const t = useTranslations('pos');
  const locale = useLocale() as 'fr' | 'ar' | 'en';
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [tendered, setTendered] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? products.filter((p) => p.name.toLowerCase().includes(term)) : products;
  }, [products, search]);

  // Totals are shown with the same arithmetic the server uses. The server recomputes on payment.
  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .filter(([, count]) => count > 0)
      .map(([id, count]) => {
        const p = byId.get(id);
        if (!p) return null;
        const amounts = lineAmounts({
          unitPriceCents: BigInt(p.priceCents),
          quantityMilli: BigInt(count) * MILLI_PER_UNIT,
          taxRate: p.taxRate,
        });
        return { id, name: p.name, count, ...amounts, lineCents: amounts.subtotalCents + amounts.taxCents };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);
  }, [cart, byId]);

  const totals = useMemo(() => orderTotals(cartLines), [cartLines]);
  const tenderedCents = tendered ? parseDzd(tendered) : null;
  const previewChange = tenderedCents === null ? null : changeDue(totals.totalCents, tenderedCents);

  function bump(id: string, delta: number): void {
    setCart((c) => {
      const next = Math.max(0, (c[id] ?? 0) + delta);
      const copy = { ...c, [id]: next };
      if (next === 0) delete copy[id];
      return copy;
    });
  }

  function pay(method: PayMethod): void {
    setError(null);
    const snapshot = cartLines;
    const payload = {
      sessionId,
      method,
      lines: snapshot.map((l) => ({ productId: l.id, quantity: String(l.count) })),
      tendered: method === 'cash' && tendered ? tendered : undefined,
    };
    startTransition(async () => {
      const r = await payOrderAct(payload);
      if (!r.ok) {
        setError(t(`errors.${errorKey(r.error.message)}`));
        return;
      }
      const done: WirePaidOrder = r.value;
      setReceipt({
        number: done.number,
        method,
        totalCents: BigInt(done.totalCents),
        changeCents: done.changeCents === null ? null : BigInt(done.changeCents),
        lines: snapshot.map((l) => ({ name: l.name, count: l.count, lineCents: l.lineCents })),
      });
      setCart({});
      setTendered('');
    });
  }

  const money = (c: Cents): string => formatDzd(c, locale);

  return (
    <div className="flex min-h-dvh flex-col gap-3 p-3 md:flex-row md:gap-4">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        .pos-ticket, .pos-ticket * { visibility: visible !important; }
        .pos-ticket { position: absolute; inset-inline-start: 0; top: 0; width: 80mm; }
      }`}</style>

      <section className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">{t('sale.title')}</h1>
          <CloseSessionDialog sessionId={sessionId} />
        </div>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('sale.search')}
          aria-label={t('sale.search')}
          className="min-h-11"
        />
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('sale.empty')}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => bump(p.id, 1)}
                  className="flex min-h-11 w-full flex-col items-start gap-1 rounded-md border bg-card p-3 text-start"
                >
                  <span className="line-clamp-2 text-sm font-medium">{p.name}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {money(BigInt(p.priceCents))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="flex w-full flex-col gap-3 rounded-md border bg-card p-3 md:w-80 md:shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t('sale.cart')}</h2>
          {cartLines.length > 0 ? (
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => setCart({})}>
              {t('sale.clear')}
            </Button>
          ) : null}
        </div>

        {cartLines.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('sale.cartEmpty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {cartLines.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">{l.name}</span>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" className="min-h-11 min-w-11" aria-label={t('sale.qtyDecrease')} onClick={() => bump(l.id, -1)}>
                    −
                  </Button>
                  <span className="min-w-8 text-center tabular-nums">{l.count}</span>
                  <Button type="button" variant="outline" className="min-h-11 min-w-11" aria-label={t('sale.qtyIncrease')} onClick={() => bump(l.id, 1)}>
                    +
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between border-t pt-3 font-semibold">
          <span>{t('sale.total')}</span>
          <span className="tabular-nums">{money(totals.totalCents)}</span>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          {t('sale.tendered')}
          <Input
            inputMode="decimal"
            value={tendered}
            onChange={(e) => setTendered(e.target.value)}
            className="min-h-11"
          />
        </label>
        {previewChange !== null ? (
          <p className="text-sm">
            {t('sale.change')}: <span className="tabular-nums">{money(previewChange)}</span>
          </p>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          {(['cash', 'cib', 'edahabia'] as const).map((m) => (
            <Button
              key={m}
              type="button"
              className="min-h-11"
              disabled={pending || cartLines.length === 0}
              onClick={() => pay(m)}
            >
              {t(`sale.payWith.${m}`)}
            </Button>
          ))}
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {receipt ? (
          <div className="flex flex-col gap-2 rounded-md border p-3">
            <p className="text-sm font-medium">{t('sale.paid')}</p>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => window.print()}>
              {t('sale.print')}
            </Button>
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => setReceipt(null)}>
              {t('sale.newSale')}
            </Button>
            <div className="pos-ticket w-full max-w-[80mm] bg-white p-2 font-mono text-[12px] text-black">
              <p className="text-center font-bold">{t('sale.ticketTitle')}</p>
              <p>
                {t('sale.ticketNumber')}: {receipt.number}
              </p>
              <ul>
                {receipt.lines.map((l) => (
                  <li key={l.name} className="flex justify-between gap-2">
                    <span>
                      {l.count} x {l.name}
                    </span>
                    <span className="tabular-nums">{money(l.lineCents)}</span>
                  </li>
                ))}
              </ul>
              <p className="flex justify-between font-bold">
                <span>{t('sale.total')}</span>
                <span className="tabular-nums">{money(receipt.totalCents)}</span>
              </p>
              <p>{t(`sale.payWith.${receipt.method}`)}</p>
              {receipt.changeCents !== null ? (
                <p>
                  {t('sale.change')}: <span className="tabular-nums">{money(receipt.changeCents)}</span>
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
