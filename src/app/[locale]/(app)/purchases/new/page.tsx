import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { partnerOptions } from '@/modules/contacts/service/partners';
import { createOrderForm } from '@/modules/purchases/actions';
import { purchaseProductOptions, purchaseTaxOptions } from '@/modules/purchases/service/lookups';
import { OrderForm } from '@/modules/purchases/ui/order-form';

export default async function NewPurchaseOrderPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('purchases');
  const options = await withPageCtx(async (ctx) => ({
    partners: await partnerOptions(ctx),
    products: await purchaseProductOptions(ctx),
    taxes: await purchaseTaxOptions(ctx),
  }));

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('order.new')}</h1>
      <div className="max-w-4xl">
        <OrderForm
          action={createOrderForm}
          partners={options.partners.ok ? options.partners.value : []}
          products={options.products.ok ? options.products.value : []}
          taxes={options.taxes.ok ? options.taxes.value : []}
        />
      </div>
    </main>
  );
}
