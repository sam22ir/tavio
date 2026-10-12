import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { and, count, eq } from 'drizzle-orm';
import type { Locale } from '@/core/ctx';
import { withTenant } from '@/core/db/tenant';
import { memberships } from '@/core/db/schema/tenancy';
import { tenantForUser } from '@/core/tenancy/tenant-access';
import { partners } from '@/modules/contacts/schema';
import { products } from '@/modules/products/schema';
import { saleOrders } from '@/modules/sales/schema';
import { creditContracts } from '@/modules/credit_sales/schema';
import { cookies } from 'next/headers';
import { ChecklistHideButton } from './checklist-hide-button';
import { CHECKLIST_HIDDEN_COOKIE } from './checklist-cookie';

/**
 * First-steps list for the active company. Each step is checked by one count query.
 * Renders nothing when the user has no company.
 */
export async function GettingStartedChecklist({ locale }: { locale: Locale }) {
  if ((await cookies()).get(CHECKLIST_HIDDEN_COOKIE)?.value === '1') return null;
  const tenant = await tenantForUser({ locale });
  if (!tenant.ok) return null;
  const companyId = tenant.value.companyId;
  const t = await getTranslations('onboarding');

  const flags = await withTenant(tenant.value, async (ctx) => {
    const [prod] = await ctx.tx.select({ n: count() }).from(products).where(eq(products.companyId, companyId));
    const [cust] = await ctx.tx
      .select({ n: count() })
      .from(partners)
      .where(and(eq(partners.companyId, companyId), eq(partners.isCustomer, true)));
    const [sales] = await ctx.tx.select({ n: count() }).from(saleOrders).where(eq(saleOrders.companyId, companyId));
    const [contracts] = await ctx.tx
      .select({ n: count() })
      .from(creditContracts)
      .where(eq(creditContracts.companyId, companyId));
    const [team] = await ctx.tx
      .select({ n: count() })
      .from(memberships)
      .where(and(eq(memberships.companyId, companyId), eq(memberships.status, 'active')));
    return {
      product: Number(prod?.n ?? 0) > 0,
      customer: Number(cust?.n ?? 0) > 0,
      sale: Number(sales?.n ?? 0) + Number(contracts?.n ?? 0) > 0,
      team: Number(team?.n ?? 0) > 1,
    };
  });

  const items = [
    { key: 'product', href: `/${locale}/products/new`, done: flags.product },
    { key: 'customer', href: `/${locale}/contacts/new`, done: flags.customer },
    { key: 'sale', href: `/${locale}/sales/new`, done: flags.sale },
    { key: 'team', href: `/${locale}/settings/team`, done: flags.team },
  ] as const;
  const done = items.filter((i) => i.done).length;
  if (done === items.length) return null;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 text-card-foreground">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">{t('checklist.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('checklist.progress', { done, total: items.length })}</p>
        </div>
        <ChecklistHideButton />
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.key}>
            <Link href={item.href} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-default">
              <span
                aria-hidden="true"
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                  item.done ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                }`}
              />
              <span className={item.done ? 'text-muted-foreground line-through' : ''}>{t(`checklist.${item.key}`)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
