'use client';

import { useState } from 'react';
import { Tabs } from '@heroui/react';
import { PricingCards, type PricingPlan } from '@/site/components';

/** Monthly / yearly segmented control (HeroUI Tabs). The only client code on the pricing page. */
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
        <Tabs selectedKey={period} onSelectionChange={(key) => setPeriod(key as 'monthly' | 'yearly')} aria-label={`${labels.monthly} / ${labels.yearly}`}>
          <Tabs.ListContainer>
            <Tabs.List className="rounded-full border border-border bg-card p-1">
              <Tabs.Tab id="monthly" className="rounded-full px-4 py-2 text-sm font-medium">
                {labels.monthly}
                <Tabs.Indicator className="rounded-full bg-primary" />
              </Tabs.Tab>
              <Tabs.Tab id="yearly" className="rounded-full px-4 py-2 text-sm font-medium">
                {labels.yearly}
                <Tabs.Indicator className="rounded-full bg-primary" />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        {period === 'yearly' ? <span className="text-sm font-medium text-primary">{labels.badge}</span> : null}
      </div>
      <PricingCards plans={plans} />
    </div>
  );
}
