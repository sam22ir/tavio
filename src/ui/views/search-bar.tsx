'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { EntityDef, ListQuery } from '@/core/entities/types';
import { toSearchParams } from '@/core/entities/list-query';
import { inputVariants } from '@heroui/styles';
import { Input } from '@/ui/primitives/input';
import { cn } from '@/ui/lib/cn';
import { translateKey } from './format';

const DEBOUNCE_MS = 300;

interface SearchBarProps {
  entity: EntityDef;
  query: ListQuery;
}

export function SearchBar({ entity, query }: SearchBarProps) {
  const t = useTranslations();
  const locale = useLocale() as 'fr' | 'ar' | 'en';
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = useState(query.q ?? '');
  const [syncedQ, setSyncedQ] = useState(query.q ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = (next: ListQuery) => {
    const qs = toSearchParams({ ...next, page: 1 }).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Keep the input in sync when the URL's q changes from elsewhere (back/forward).
  const urlQ = query.q ?? '';
  if (urlQ !== syncedQ) {
    setSyncedQ(urlQ);
    setText(urlQ);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onSearchChange = (value: string) => {
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      navigate({ ...query, q: value.trim() || undefined });
    }, DEBOUNCE_MS);
  };

  const onFilterChange = (field: string, value: string) => {
    const filters = { ...query.filters };
    if (value) filters[field] = value;
    else delete filters[field];
    navigate({ ...query, filters });
  };

  const filterFields = entity.fields.filter((f) => f.filter && f.type === 'select');

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input
        type="search"
        role="searchbox"
        aria-label={t('views.search')}
        placeholder={t('views.search')}
        value={text}
        onChange={(e) => onSearchChange(e.target.value)}
        className={cn(inputVariants({ variant: 'primary' }), 'min-h-11 rounded-full px-4 sm:max-w-xs')}
      />
      {filterFields.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="sr-only sm:not-sr-only text-sm text-muted">{t('views.filters')}</span>
          {filterFields.map((field) => (
            <select
              key={field.name}
              aria-label={t(field.label)}
              value={query.filters[field.name] ?? ''}
              onChange={(e) => onFilterChange(field.name, e.target.value)}
              className={cn(inputVariants({ variant: 'primary' }), 'min-h-11 rounded-full ps-4 pe-8 text-sm')}
            >
              <option value="">{t(field.label)}</option>
              {(field.options ?? []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {translateKey(opt.label, locale)}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}
    </div>
  );
}
