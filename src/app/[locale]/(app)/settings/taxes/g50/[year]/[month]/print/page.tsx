import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import type { Locale } from '@/core/ctx';
import { formatDzd } from '@/core/money';
import { withTenant } from '@/core/db/tenant';
import { getG50Declaration } from '@/modules/l10n_dz/service/g50';
import { routing } from '@/i18n/routing';
import { loadShell } from '@/ui/shell/load-shell';
import { figureCents } from '../../../figures';

export default async function G50PrintPage({
  params,
}: {
  params: Promise<{ locale: string; year: string; month: string }>;
}) {
  const { locale, year: yearText, month: monthText } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) notFound();

  const shell = await loadShell(locale as Locale);
  const t = await getTranslations('l10n');
  const row = await withTenant(shell.tenant, (ctx) => getG50Declaration(ctx, year, month));
  if (!row) notFound();

  const fig = figureCents(row.figures);
  const money = (c: bigint) => formatDzd(c, locale as Locale);
  const lines: { label: string; value: bigint; strong?: boolean }[] = [
    { label: t('g50.print_collected'), value: fig.collected },
    { label: t('g50.print_deductible'), value: fig.deductible },
    { label: t('g50.print_net'), value: fig.net, strong: true },
    { label: t('g50.print_stamp'), value: fig.stamp },
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 bg-white p-6 text-black print:p-0">
      <p role="note" className="rounded border border-amber-600 p-2 text-sm font-semibold text-amber-900">
        {t('g50.print_draft_flag')}
      </p>
      <header className="flex flex-col gap-1 border-b border-black pb-3">
        <h1 className="text-xl font-bold">{t('g50.print_heading')}</h1>
        <p className="text-sm">
          {t('g50.print_period')}: {row.figures.period.from} → {row.figures.period.to}
        </p>
        <p className="text-sm">
          {t('g50.status')}: {row.state === 'validated' ? t('g50.status_validated') : t('g50.status_draft')}
        </p>
      </header>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {lines.map((l) => (
            <tr key={l.label} className={l.strong ? 'border-y border-black font-bold' : 'border-b border-neutral-300'}>
              <td className="py-2">{l.label}</td>
              <td className="py-2 text-end tabular-nums">{money(l.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs">{t('g50.print_accounts')}</p>
      <p className="text-xs italic">{t('g50.print_verify')}</p>
    </div>
  );
}
