import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import type { Locale } from '@/core/ctx';
import { withTenant } from '@/core/db/tenant';
import { routing } from '@/i18n/routing';
import { loadShell } from '@/ui/shell/load-shell';
import { listCustomFieldDefs } from '@/modules/platform/service/custom-fields';
import { listApiKeys } from '@/modules/platform/service/api-keys';
import { listWebhooks } from '@/modules/platform/service/webhooks';
import { PlatformSettings } from '@/modules/platform/ui/platform-settings';

export default async function PlatformSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const shell = await loadShell(locale as Locale);
  const t = await getTranslations('platform');

  const data = await withTenant(shell.tenant, async (ctx) => {
    const [fields, keys, hooks] = await Promise.all([
      listCustomFieldDefs(ctx, 'contacts.partner'),
      listApiKeys(ctx),
      listWebhooks(ctx),
    ]);
    return {
      fields: fields.ok ? fields.value : [],
      keys: keys.ok ? keys.value : [],
      hooks: hooks.ok ? hooks.value : [],
    };
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('settings.title')}</h1>
        <p className="text-sm text-muted">{t('settings.intro')}</p>
      </header>
      <PlatformSettings
        fields={data.fields.map((f) => ({
          id: f.id,
          key: f.key,
          labelFr: f.labelFr,
          labelAr: f.labelAr,
          labelEn: f.labelEn,
          fieldType: f.fieldType,
          options: (f.options as string[] | null) ?? [],
          required: f.required,
          position: f.position,
        }))}
        keys={data.keys.map((k) => ({
          id: k.id,
          name: k.name,
          prefix: k.prefix,
          scopes: k.scopes,
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          revokedAt: k.revokedAt?.toISOString() ?? null,
        }))}
        hooks={data.hooks.map((h) => ({ id: h.id, url: h.url, events: h.events, active: h.active }))}
      />
    </div>
  );
}
