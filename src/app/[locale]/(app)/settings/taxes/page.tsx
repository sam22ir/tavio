import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import type { Locale } from '@/core/ctx';
import { withTenant } from '@/core/db/tenant';
import { listTaxes } from '@/modules/l10n_dz/service/taxes';
import { getL10nSettings, loadStampTiers } from '@/modules/l10n_dz';
import Link from 'next/link';
import { routing } from '@/i18n/routing';
import { loadShell } from '@/ui/shell/load-shell';
import { Badge } from '@/ui/primitives/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/primitives/table';
import { ArchiveTaxButton, LoadDefaultsButton, TaxForm } from './tax-forms';
import { RegimeForm, StampSettingsForm } from './settings-forms';

export default async function TaxesSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const shell = await loadShell(locale as Locale);
  const t = await getTranslations('l10n');

  const { rows, settings, tiers } = await withTenant(shell.tenant, async (ctx) => ({
    rows: await listTaxes(ctx),
    settings: await getL10nSettings(ctx),
    tiers: await loadStampTiers(ctx),
  }));
  const stampRows = tiers.map((tier) => ({
    upTo: tier.upToDa === null ? '' : tier.upToDa.toString(),
    mode: tier.mode,
    value: tier.mode === 'fixed' ? `${tier.fixedCents / BigInt(100)}.${String(tier.fixedCents % BigInt(100)).padStart(2, '0')}` : tier.ratePercent,
  }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{t('taxes.title')}</h1>
        <p role="note" className="rounded-md border bg-tint-warning p-3 text-sm text-tint-warning-fg">
          {t('taxes.warning')}
        </p>
        <LoadDefaultsButton />
      </header>

      <section aria-labelledby="tax-list-title" className="flex flex-col gap-3">
        <h2 id="tax-list-title" className="text-lg font-medium">
          {t('tax.title')}
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">{t('taxes.empty')}</p>
        ) : (
          <section className="app-panel flex flex-col gap-4 p-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('fields.code')}</TableHead>
                  <TableHead>{t('fields.name')}</TableHead>
                  <TableHead>{t('fields.kind')}</TableHead>
                  <TableHead className="text-end">{t('fields.rate')}</TableHead>
                  <TableHead>{t('fields.scope')}</TableHead>
                  <TableHead>{t('fields.validFrom')}</TableHead>
                  <TableHead>{t('fields.active')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{t(`options.kind.${r.kind}`)}</TableCell>
                    <TableCell className="text-end tabular-nums">{Number(r.rate)}%</TableCell>
                    <TableCell>{t(`options.scope.${r.scope}`)}</TableCell>
                    <TableCell>{r.validFrom}</TableCell>
                    <TableCell>
                      <Badge variant={r.active ? 'default' : 'secondary'}>
                        {r.active ? t('taxes.status_active') : t('taxes.status_inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.active ? <ArchiveTaxButton id={r.id} /> : null}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}
      </section>

 <section aria-labelledby="regime-title" className="flex flex-col gap-3">
        <h2 id="regime-title" className="text-lg font-medium">{t('regime.title')}</h2>
        <RegimeForm initial={settings.taxRegime} />
      </section>

      <section aria-labelledby="stamp-title" className="flex flex-col gap-3">
        <h2 id="stamp-title" className="text-lg font-medium">{t('stamp.title')}</h2>
        <StampSettingsForm methods={settings.stampMethods} rows={stampRows} />
      </section>

      <section aria-labelledby="g50-link-title" className="flex flex-col gap-2">
        <h2 id="g50-link-title" className="text-lg font-medium">{t('g50.title')}</h2>
        <p className="text-sm text-muted">{t('g50.intro')}</p>
        <Link href="/settings/taxes/g50" className="text-sm font-medium underline underline-offset-4">
          {t('g50.open')}
        </Link>
      </section>

      <section aria-labelledby="tax-create-title" className="flex flex-col gap-3">
        <h2 id="tax-create-title" className="text-lg font-medium">
          {t('taxes.create_title')}
        </h2>
        <TaxForm />
      </section>
    </div>
  );
}
