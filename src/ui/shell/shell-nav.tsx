'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CompanySwitcher } from '@/ui/shell/company-switcher';
import { LocaleSwitcher } from '@/ui/shell/locale-switcher';
import { UserMenu } from '@/ui/shell/user-menu';
import type { ShellCompany, ShellNavItem } from '@/ui/shell/load-shell';

export interface ShellNavProps {
  items: ShellNavItem[];
  companies: ShellCompany[];
  activeCompanyId: string;
  email: string;
  onNavigate?: () => void;
}

/** The full navigation panel: menu links, company switcher, locale switcher and user menu. */
export function ShellNav({ items, companies, activeCompanyId, email, onNavigate }: ShellNavProps) {
  const t = useTranslations('shell');
  const tAll = useTranslations();
  const pathname = usePathname();
  // Menu labels are full i18n keys (e.g. contacts.menu.partners); fall back to the raw key when missing.
  const labelOf = (key: string) => (tAll.has(key) ? tAll(key) : key);

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <nav aria-label={t('nav.title')} className="flex flex-col gap-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={
                'rounded-md px-3 py-2 text-sm ' +
                (active ? 'bg-accent font-medium text-accent-foreground' : 'text-foreground hover:bg-accent')
              }
            >
              {labelOf(item.label)}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-4">
        <CompanySwitcher companies={companies} activeCompanyId={activeCompanyId} />
        <LocaleSwitcher />
        <UserMenu email={email} />
      </div>
    </div>
  );
}
