import Link from 'next/link';
import { Button } from '@/ui/primitives/button';
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
  /** Marks the plan most buyers pick. */
  highlighted?: boolean;
  badge?: string;
}

/**
 * Plan cards for the pricing teaser and the pricing page.
 * Mobile: 1 column. Desktop: one column per plan.
 */
export function PricingCards({ plans }: { plans: PricingPlan[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {plans.map((plan) => (
        <li
          key={plan.name}
          className={`flex flex-col gap-5 rounded-2xl border p-6 ${
            plan.highlighted ? 'border-primary bg-card ring-1 ring-primary/40' : 'border-border bg-card'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">{plan.name}</h3>
            {plan.badge ? <Badge tone="accent">{plan.badge}</Badge> : null}
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-3xl font-semibold tracking-tight">{plan.price}</p>
            <p className="text-sm text-muted-foreground">{plan.period}</p>
          </div>
          <p className="text-sm font-medium">{plan.users}</p>
          <ul className="flex flex-1 flex-col gap-2 text-sm text-muted-foreground">
            {plan.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <Button asChild variant={plan.highlighted ? 'default' : 'outline'} className="w-full">
            <Link href={plan.href}>{plan.cta}</Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}
