import type { ReactNode } from 'react';
import { cn } from '@/ui/lib/cn';

export type MockVariant = 'installments' | 'kanban' | 'invoice' | 'pos' | 'dashboard';

/**
 * HTML/CSS illustration of a Tavio screen, with DZD amounts and French/Arabic labels.
 * Decorative only: hidden from assistive tech. Not a real screenshot.
 * Mobile: fills its column and scrolls internally if needed.
 */
export function MockScreen({ variant, className }: { variant: MockVariant; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('w-full overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm', className)}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs">
        <span className="font-semibold">{TITLES[variant]}</span>
        <span className="text-muted-foreground">Tavio</span>
      </div>
      <div className="p-4 md:p-5">{BODY[variant]}</div>
    </div>
  );
}

const TITLES: Record<MockVariant, string> = {
  installments: 'Ventes à crédit · Plan d\'échelonnement',
  kanban: 'CRM · Pipeline commercial',
  invoice: 'Facture · فاتورة',
  pos: 'Caisse · نقطة البيع',
  dashboard: 'Tableau de bord · لوحة التحكم',
};

const Row = ({ a, b, tone }: { a: string; b: string; tone?: 'ok' | 'wait' | 'late' }) => (
  <div className="flex items-center justify-between gap-3 border-b border-border py-2 text-xs last:border-0">
    <span className="truncate">{a}</span>
    <span className="flex items-center gap-2 whitespace-nowrap">
      <span className="font-medium tabular-nums">{b}</span>
      {tone ? (
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px]',
            tone === 'ok' && 'bg-primary/15 text-primary',
            tone === 'wait' && 'bg-muted text-muted-foreground',
            tone === 'late' && 'bg-destructive/15 text-destructive',
          )}
        >
          {tone === 'ok' ? 'Payé' : tone === 'wait' ? 'En attente' : 'En retard'}
        </span>
      ) : null}
    </span>
  </div>
);

const Card = ({ title, sub, amount }: { title: string; sub: string; amount: string }) => (
  <div className="rounded-xl border border-border bg-background p-3 text-xs">
    <p className="font-medium">{title}</p>
    <p className="mt-1 text-muted-foreground">{sub}</p>
    <p className="mt-2 font-semibold tabular-nums">{amount}</p>
  </div>
);

const BODY: Record<MockVariant, ReactNode> = {
  installments: (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">Karim Benali</p>
        <p className="text-xs text-muted-foreground">Réfrigérateur · 4 échéances</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-muted/60 p-3">
          <p className="text-[10px] text-muted-foreground">Total à payer</p>
          <p className="text-sm font-semibold tabular-nums">74 000 DZD</p>
        </div>
        <div className="rounded-xl bg-muted/60 p-3">
          <p className="text-[10px] text-muted-foreground">Restant dû</p>
          <p className="text-sm font-semibold tabular-nums">36 500 DZD</p>
        </div>
      </div>
      <div>
        <Row a="Échéance 1 · 15/10" b="18 500 DZD" tone="ok" />
        <Row a="Échéance 2 · 15/11" b="18 500 DZD" tone="late" />
        <Row a="Échéance 3 · 15/12" b="18 500 DZD" tone="wait" />
        <Row a="Échéance 4 · 15/01" b="18 500 DZD" tone="wait" />
      </div>
    </div>
  ),
  kanban: (
    <div className="grid grid-cols-3 gap-2">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold text-muted-foreground">Prospects</p>
        <Card title="Atelier Ferhat" sub="Mobilier" amount="45 000 DZD" />
        <Card title="Clinique Al Nour" sub="Équipement" amount="210 000 DZD" />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold text-muted-foreground">Devis envoyé</p>
        <Card title="Centre Ibn Sina" sub="Formation" amount="132 000 DZD" />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold text-muted-foreground">Gagné</p>
        <Card title="Garage Sidi Yahia" sub="Véhicules" amount="980 000 DZD" />
      </div>
    </div>
  ),
  invoice: (
    <div className="flex flex-col gap-3 text-xs">
      <div className="flex justify-between">
        <div>
          <p className="font-semibold">N° 2026-0148</p>
          <p className="text-muted-foreground">NIF : 0000000000000000</p>
        </div>
        <p className="text-muted-foreground">15/10/2026</p>
      </div>
      <div>
        <Row a="Climatiseur 12 000 BTU × 1" b="78 000 DZD" />
        <Row a="Installation × 1" b="5 000 DZD" />
      </div>
      <div className="flex flex-col gap-1 pt-1 text-right">
        <p className="text-muted-foreground tabular-nums">Sous-total HT : 83 000 DZD</p>
        <p className="text-muted-foreground tabular-nums">TVA 19 % : 15 770 DZD</p>
        <p className="text-sm font-semibold tabular-nums">Total TTC : 98 770 DZD</p>
      </div>
    </div>
  ),
  pos: (
    <div className="grid grid-cols-5 gap-4">
      <div className="col-span-3 grid grid-cols-2 gap-2">
        {['Café', 'Pain', 'Jus', 'Lait'].map((p) => (
          <div key={p} className="rounded-xl border border-border bg-background p-3 text-xs font-medium">
            {p}
          </div>
        ))}
      </div>
      <div className="col-span-2 flex flex-col gap-2 rounded-xl bg-muted/60 p-3 text-xs">
        <Row a="Café × 2" b="400 DZD" />
        <Row a="Pain × 1" b="25 DZD" />
        <p className="pt-2 text-sm font-semibold tabular-nums">425 DZD</p>
        <p className="rounded-lg bg-primary py-2 text-center text-[11px] text-primary-foreground">Espèces</p>
      </div>
    </div>
  ),
  dashboard: (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <Card title="Ventes du mois" sub="+12 % vs mois précédent" amount="2 480 000 DZD" />
        <Card title="Créances ouvertes" sub="23 clients" amount="386 500 DZD" />
      </div>
      <div className="flex h-24 items-end gap-2 rounded-xl bg-muted/60 p-3">
        {[40, 62, 48, 75, 58, 90, 70].map((h, i) => (
          <span key={i} className="flex-1 rounded-t bg-primary/70" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div>
        <Row a="Facture 2026-0147" b="98 770 DZD" tone="ok" />
        <Row a="Facture 2026-0146" b="24 300 DZD" tone="wait" />
      </div>
    </div>
  ),
};
