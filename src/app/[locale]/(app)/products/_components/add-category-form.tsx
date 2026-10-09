'use client';

import { toast } from 'sonner';
import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createCategoryAction } from '@/modules/products/actions';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';

// Creates a category inline and selects it on the form by reloading with ?category=<id>.
export function AddCategoryForm() {
  const t = useTranslations('products');
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await createCategoryAction({ name, code: '', parentId: '' });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      toast.error(result.error.message);
      return;
    }
    setOpen(false);
    setName('');
    router.replace(`${pathname}?category=${result.value.id}`);
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t('category.add')}
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1">
        <Label htmlFor="new-category-name">{t('fields.name')}</Label>
        <Input
          id="new-category-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending || name.trim() === ''}>
          {t('category.create')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          {t('category.cancel')}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive sm:basis-full">
          {error}
        </p>
      ) : null}
    </form>
  );
}
