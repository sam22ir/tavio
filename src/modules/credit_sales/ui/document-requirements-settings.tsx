'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import { saveDocumentRequirementAction } from '../actions/workflow';

export interface RequirementView { id: string; name: string; required: boolean; active: boolean }

/** Settings list for the company's document template. Toggles and adds save immediately. */
export function DocumentRequirementsSettings({ rows }: { rows: RequirementView[] }) {
  const t = useTranslations('credit.requirements');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');

  const save = (input: { id?: string; name: string; required: boolean; active: boolean }) =>
    startTransition(async () => {
      const result = await saveDocumentRequirementAction(input);
      if (!result.ok) {
        toast.error(result.error?.message ?? t('saved'));
        return;
      }
      toast.success(t('saved'));
      router.refresh();
    });

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{t('title')}</h2>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-4 text-sm">
            <span className="grow">{row.name}</span>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={row.required} disabled={pending}
                onChange={(e) => save({ id: row.id, name: row.name, required: e.target.checked, active: row.active })} />
              {t('required')}
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={row.active} disabled={pending}
                onChange={(e) => save({ id: row.id, name: row.name, required: row.required, active: e.target.checked })} />
              {t('active')}
            </label>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          save({ name, required: true, active: true });
          setName('');
        }}
      >
        <div className="grow">
          <Label htmlFor="requirement-name">{t('name')}</Label>
          <Input id="requirement-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="submit" disabled={pending || !name.trim()}>{t('add')}</Button>
      </form>
    </section>
  );
}
