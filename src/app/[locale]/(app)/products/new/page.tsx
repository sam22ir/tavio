import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { productEntity } from '@/modules/products/entities';
import { listCategories } from '@/modules/products/service/categories';
import { uomOptions } from '@/modules/products/service/uoms';
import { createProductFormAction } from '@/modules/products/actions';
import { RecordForm } from '@/ui/views/record-form';
import { categoryIdParam } from '../_lib';
import { AddCategoryForm } from '../_components/add-category-form';

export default async function NewProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const selectedCategory = categoryIdParam((await searchParams).category);
  const t = await getTranslations('products');
  const { categories, uoms } = await withPageCtx(async (ctx) => {
    const c = await listCategories(ctx);
    const u = await uomOptions(ctx);
    if (!c.ok) throw new Error(c.error.code);
    if (!u.ok) throw new Error(u.error.code);
    return { categories: c.value, uoms: u.value };
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t('product.new')}</h1>
      <AddCategoryForm />
      <RecordForm
        key={selectedCategory ?? 'none'}
        entity={productEntity}
        action={createProductFormAction}
        values={{ active: true, trackStock: false, categoryId: selectedCategory ?? null }}
        relationOptions={{
          categoryId: categories.map((c) => ({ value: c.id, label: c.name })),
          uomId: uoms,
        }}
      />
    </div>
  );
}
