'use client';

import { useState } from 'react';
import { PricingCards, type PricingPlan } from '@/site/components';

/** Monthly / yearly segmented pill control. The only client code on the pricing page. */
export function PricingToggle({
  monthly,
  yearly,
  labels,
}: {
  monthly: PricingPlan[];
  yearly: PricingPlan[];
  labels: { monthly: string; yearly: string; badge: string; save: string };
}) {
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const plans = period === 'monthly' ? monthly : yearly;

  const segment = (id: 'monthly' | 'yearly', label: string, chip?: string) => {
    const selected = period === id;
    return (
      <button
        type="button"
        role="tab"
        aria-selected={selected}
        onClick={() => setPeriod(id)}
        className={
          'inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors ' +
          (selected ? 'bg-[#0F1A17] text-white shadow-sm' : 'text-[#0F1A17] hover:bg-black/5')
        }
      >
        {label}
        {chip ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">{chip}</span>
        ) : null}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label={`${labels.monthly} / ${labels.yearly}`}
          className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white p-1 shadow-sm"
        >
          {segment('monthly', labels.monthly)}
          {segment('yearly', labels.yearly, labels.save)}
        </div>
      </div>
      <PricingCards plans={plans} />
    </div>
  );
}
