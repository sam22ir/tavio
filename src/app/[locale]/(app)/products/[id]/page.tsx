import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { productEntity } from '@/modules/products/entities';
import { getProduct } from '@/modules/products/service/products';
import { listCategories } from '@/modules/products/service/categories';
import { uomOptions } from '@/modules/products/service/uoms';
import { updateProductFormAction } from '@/modules/products/actions';
import { RecordForm } from '@/ui/views/record-form';
import { categoryIdParam, toFormValues } from '../_lib';
import { AddCategoryForm } from '../_components/add-category-form';

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const selectedCategory = categoryIdParam((await searchParams).category);
  const t = await getTranslations('products');
  const { product, categories, uoms } = await withPageCtx(async (ctx) => {
    const p = await getProduct(ctx, id);
    const c = await listCategories(ctx);
    const u = await uomOptions(ctx);
    if (!p.ok) return { product: null, categories: [], uoms: [] };
    if (!c.ok) throw new Error(c.error.code);
    if (!u.ok) throw new Error(u.error.code);
    return { product: p.value, categories: c.value, uoms: u.value };
  });
  if (!product) notFound();

  const values = toFormValues(product);
  if (selectedCategory) values.categoryId = selectedCategory;

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">{t('product.edit')}</h1>
      <AddCategoryForm />
      <RecordForm
        key={selectedCategory ?? 'saved'}
        entity={productEntity}
        action={updateProductFormAction}
        values={values}
        hidden={{ id }}
        relationOptions={{
          categoryId: categories.map((c) => ({ value: c.id, label: c.name })),
          uomId: uoms,
        }}
      />
    </div>
  );
}
