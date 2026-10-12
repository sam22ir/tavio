import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { addSupplierForm } from '@/modules/purchases/actions';
import { listProductSuppliers, productSupplierOptions } from '@/modules/purchases/service/product-suppliers';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';

const selectClass =
  'h-11 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2';

export default async function PurchaseSuppliersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('purchases');
  const tr = await getTranslations();
  const rawError = (await searchParams).error;
  const errorCode = typeof rawError === 'string' ? rawError : undefined;

  const [rows, options] = await withPageCtx(async (ctx) => [
    await listProductSuppliers(ctx),
    await productSupplierOptions(ctx),
  ]);
  if (!rows.ok || !options.ok) {
    return (
      <div className="p-4 md:p-6">
        <p role="alert" className="text-sm text-destructive">{t('errors.internal')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('suppliers.title')}</h1>
      {errorCode ? (
        <p role="alert" className="text-sm text-destructive">
          {tr(`purchases.errors.${errorCode.toLowerCase()}`)}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[28rem] text-sm">
          <thead className="bg-default/50 text-start">
            <tr>
              <th className="p-3 text-start">{t('fields.product')}</th>
              <th className="p-3 text-start">{t('fields.partner')}</th>
              <th className="p-3 text-end">{t('suppliers.sequence')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.value.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.productName}</td>
                <td className="p-3">{r.partnerName}</td>
                <td className="p-3 text-end tabular-nums">{r.sequence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={addSupplierForm} className="flex flex-col gap-3 rounded-md border p-4 sm:max-w-xl">
        <h2 className="text-base font-medium">{t('suppliers.add')}</h2>
        <label className="flex flex-col gap-1.5 text-sm">
          {t('fields.product')}
          <select name="productId" required className={selectClass}>
            {options.value.products.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          {t('fields.partner')}
          <select name="partnerId" required className={selectClass}>
            {options.value.suppliers.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          {t('suppliers.sequence')}
          <Input name="sequence" inputMode="numeric" defaultValue="10" className="h-11 max-w-32" />
        </label>
        <Button type="submit" className="min-h-11 sm:w-fit">{t('suppliers.save')}</Button>
      </form>
    </div>
  );
}
