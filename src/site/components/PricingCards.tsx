'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Badge } from './Badge';
import { CtaLink } from './CtaLink';

export interface PricingPlan {
  name: string;
  /** Preformatted price, e.g. "2 900 DZD" or "Free". */
  price: string;
  /** Period line, e.g. "/ user / month". */
  period: string;
  /** Seat limit line, e.g. "Up to 5 users". */
  users: string;
  features: string[];
  href: string;
  cta: string;
  /** Marks the plan most buyers pick. Shown on the dark ink card. */
  highlighted?: boolean;
  badge?: string;
}

/**
 * Plan cards for the pricing teaser and the pricing page.
 * Mobile: 1 column. Desktop: one column per plan. The highlighted plan is an ink card.
 */
export function PricingCards({ plans }: { plans: PricingPlan[] }) {
  const reduce = useReducedMotion();
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {plans.map((plan) => (
        <motion.li
          key={plan.name}
          whileHover={reduce ? undefined : { y: -6 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          className={`flex flex-col gap-5 rounded-[28px] p-7 ${
            plan.highlighted
              ? 'bg-[var(--s-ink)] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),0_24px_48px_-24px_rgba(15,26,23,0.6)]'
              : 's-panel'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg">{plan.name}</h3>
            {plan.badge ? <Badge tone="accent">{plan.badge}</Badge> : null}
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-4xl font-bold tracking-tight"><bdi>{plan.price}</bdi></p>
            <p className={`text-sm ${plan.highlighted ? 'text-white/65' : 'text-[color:var(--s-muted)]'}`}>{plan.period}</p>
          </div>
          <p className="text-sm font-medium">{plan.users}</p>
          <ul className={`flex flex-1 flex-col gap-2 text-[15px] ${plan.highlighted ? 'text-white/75' : 'text-[color:var(--s-muted)]'}`}>
            {plan.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <CtaLink
            href={plan.href}
            label={plan.cta}
            variant={plan.highlighted ? 'light' : 'dark'}
            className="w-full justify-between"
          />
        </motion.li>
      ))}
    </ul>
  );
}
