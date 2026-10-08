'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { switchCompany } from '@/ui/shell/actions';
import type { ShellCompany } from '@/ui/shell/load-shell';
import { Button } from '@/ui/primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/ui/primitives/dropdown-menu';

export function CompanySwitcher({
  companies,
  activeCompanyId,
}: {
  companies: ShellCompany[];
  activeCompanyId: string;
}) {
  const t = useTranslations('shell');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const active = companies.find((c) => c.id === activeCompanyId) ?? companies[0];

  function choose(id: string) {
    if (id === activeCompanyId) return;
    setError(null);
    startTransition(async () => {
      const res = await switchCompany(id);
      if (res.ok) router.refresh();
      else setError(t('company.error'));
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{t('company.label')}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full justify-between" disabled={pending} aria-label={t('company.switch')}>
            <span className="truncate">{active?.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56">
          <DropdownMenuLabel>{t('company.switch')}</DropdownMenuLabel>
          {companies.map((c) => (
            <DropdownMenuItem key={c.id} onSelect={() => choose(c.id)} aria-current={c.id === activeCompanyId}>
              {c.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
