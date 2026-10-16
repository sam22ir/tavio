import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { asc, eq, and } from 'drizzle-orm';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { partners } from '@/modules/contacts/schema';
import { products } from '@/modules/products/schema';
import { ContractForm } from '@/modules/credit_sales/ui/contract-form';

export default async function NewContractPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('credit');

  const { partnerOptions, productOptions } = await withPageCtx(async (ctx) => {
    const partnerRows = await ctx.tx
      .select({ id: partners.id, displayName: partners.displayName })
      .from(partners)
      .where(and(eq(partners.companyId, ctx.companyId), eq(partners.active, true)))
      .orderBy(asc(partners.displayName))
      .limit(500);
    const productRows = await ctx.tx
      .select({ id: products.id, name: products.name, nameAr: products.nameAr, salePriceCents: products.salePriceCents })
      .from(products)
      .where(and(eq(products.companyId, ctx.companyId), eq(products.active, true)))
      .orderBy(asc(products.name))
      .limit(500);
    return {
      partnerOptions: partnerRows.map((p) => ({ value: p.id, label: p.displayName })),
      productOptions: productRows.map((p) => ({
        value: p.id,
        label: (locale === 'ar' && p.nameAr) || p.name,
        unitPriceCents: p.salePriceCents.toString(),
      })),
    };
  });

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t('contract.new')}</h1>
      <ContractForm partners={partnerOptions} products={productOptions} />
    </section>
  );
}

