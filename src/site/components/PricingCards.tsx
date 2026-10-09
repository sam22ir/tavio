import Link from 'next/link';
import { Badge } from './Badge';

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
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {plans.map((plan) => (
        <li
          key={plan.name}
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
          <Link
            href={plan.href}
            className={`s-btn s-btn-arrow w-full justify-between ${plan.highlighted ? 's-btn-light' : 's-btn-dark'}`}
          >
            <span>{plan.cta}</span>
            <span className="s-btn-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className="s-flip-rtl" aria-hidden>
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
