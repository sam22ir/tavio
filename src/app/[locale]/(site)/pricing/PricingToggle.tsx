'use client';

import { useState } from 'react';
import { PricingCards, type PricingPlan } from '@/site/components';
import { cn } from '@/ui/lib/cn';

/** Monthly / yearly switch. The only client code on the pricing page. */
export function PricingToggle({
  monthly,
  yearly,
  labels,
}: {
  monthly: PricingPlan[];
  yearly: PricingPlan[];
  labels: { monthly: string; yearly: string; badge: string };
}) {
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const plans = period === 'monthly' ? monthly : yearly;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label={labels.monthly + ' / ' + labels.yearly} className="inline-flex rounded-full border border-border bg-card p-1 text-sm">
          {(['monthly', 'yearly'] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={period === key}
              onClick={() => setPeriod(key)}
              className={cn(
                'rounded-full px-4 py-2 font-medium transition-colors duration-200',
                period === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {key === 'monthly' ? labels.monthly : labels.yearly}
            </button>
          ))}
        </div>
        {period === 'yearly' ? <span className="text-sm font-medium text-primary">{labels.badge}</span> : null}
      </div>
      <PricingCards plans={plans} />
    </div>
  );
}
