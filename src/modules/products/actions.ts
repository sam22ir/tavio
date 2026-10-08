'use server';

import { getLocale } from 'next-intl/server';
import { defineAction, toFormAction } from '@/core/actions/define-action';
import type { FormState } from '@/core/entities/types';
import { archiveProduct, createProduct, productInput, productUpdateInput, updateProduct } from './service/products';
import { categoryInput, createCategory } from './service/categories';
import { z } from 'zod';

const MODULE = 'products';

export const createProductAction = defineAction(
  { perm: 'products.product.write', schema: productInput, module: MODULE },
  (ctx, input) => createProduct(ctx, input),
);

export const updateProductAction = defineAction(
  { perm: 'products.product.write', schema: productUpdateInput, module: MODULE },
  (ctx, input) => updateProduct(ctx, input),
);

export const archiveProductAction = defineAction(
  { perm: 'products.product.write', schema: z.object({ id: z.uuid() }), module: MODULE },
  (ctx, input) => archiveProduct(ctx, input.id),
);

export const createCategoryAction = defineAction(
  { perm: 'products.category.write', schema: categoryInput, module: MODULE },
  (ctx, input) => createCategory(ctx, input),
);

// Form handlers for <form action> / useActionState. Redirects are prefixed with the current locale.
const createProductForm = toFormAction(createProductAction, {
  schema: productInput,
  redirectTo: (v) => `/products/${v.id}`,
});
const updateProductForm = toFormAction(updateProductAction, {
  schema: productUpdateInput,
  redirectTo: () => '/products',
});

async function withLocale(state: FormState): Promise<FormState> {
  if (!state.redirectTo) return state;
  return { ...state, redirectTo: `/${await getLocale()}${state.redirectTo}` };
}

export async function createProductFormAction(prev: FormState, fd: FormData): Promise<FormState> {
  return withLocale(await createProductForm(prev, fd));
}

export async function updateProductFormAction(prev: FormState, fd: FormData): Promise<FormState> {
  return withLocale(await updateProductForm(prev, fd));
}
