import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { createWarehouseForm } from '@/modules/inventory/actions';
import { listWarehouses } from '@/modules/inventory/service/warehouses';
import { ActionForm } from '@/modules/inventory/ui/action-form';

export default async function WarehousesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('inventory');
  const result = await withPageCtx((ctx) => listWarehouses(ctx));

  return (
    <main className="flex flex-col gap-8 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('warehouses.title')}</h1>
      {result.ok ? (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 text-start font-medium">{t('fields.code')}</th>
                <th className="p-3 text-start font-medium">{t('fields.name')}</th>
                <th className="p-3 text-start font-medium">{t('fields.wilaya_code')}</th>
              </tr>
            </thead>
            <tbody>
              {result.value.map((w) => (
                <tr key={w.id} className="border-t">
                  <td className="p-3">{w.code}</td>
                  <td className="p-3 break-words">{w.name}</td>
                  <td className="p-3">{w.wilayaCode ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p role="alert" className="text-sm text-destructive">{t('common.error')}</p>
      )}
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">{t('warehouses.new')}</h2>
        <ActionForm
          action={createWarehouseForm}
          submitLabel={t('common.submit')}
          successMessage={t('warehouses.created')}
          fields={[
            { name: 'code', label: t('fields.code'), required: true, hint: t('warehouses.code_hint') },
            { name: 'name', label: t('fields.name'), required: true },
            { name: 'wilayaCode', label: t('fields.wilaya_code'), hint: '01–58' },
          ]}
        />
      </section>
    </main>
  );
}
