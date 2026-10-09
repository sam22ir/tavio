'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Button, Dropdown } from '@heroui/react';

const LANGUAGES = [
  { code: 'fr', name: 'Français' },
  { code: 'ar', name: 'العربية' },
  { code: 'en', name: 'English' },
] as const;

/** Language menu (HeroUI Dropdown). Switches the locale prefix of the current path, keeping the same page. */
export function LocaleSwitcher({ className }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = useLocale();
  const t = useTranslations('site.nav');
  const currentName = LANGUAGES.find((l) => l.code === current)?.name ?? current.toUpperCase();

  return (
    <Dropdown>
      <Button variant="ghost" size="sm" className={`rounded-full text-sm ${className ?? ''}`} aria-label={t('language')}>
        {currentName}
      </Button>
      <Dropdown.Popover placement="bottom end" className="rounded-2xl">
        <Dropdown.Menu
          aria-label={t('language')}
          selectionMode="single"
          selectedKeys={[current]}
          onAction={(key) => {
            const code = String(key);
            router.push(pathname.replace(/^\/(fr|ar|en)(?=\/|$)/, `/${code}`));
          }}
        >
          {LANGUAGES.map(({ code, name }) => (
            <Dropdown.Item key={code} id={code} textValue={name} lang={code}>
              {name}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
