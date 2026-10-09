import Link from 'next/link';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { formatDzd, sumCents, type Cents } from '@/core/money';
import { loadShell } from '@/ui/shell/load-shell';
import { buildReminderMessage, whatsappLink } from '@/modules/credit_sales/service/reminders';
import { listDueSoon, listOverdue, type OverdueRow } from '@/modules/credit_sales/service/payments';
import { AiDraftButton } from './ai-draft-button';

interface PartnerGroup {
  partnerId: string;
  partnerName: string;
  partnerPhone: string | null;
  rows: OverdueRow[];
  totalCents: Cents;
}

function groupByPartner(rows: OverdueRow[]): PartnerGroup[] {
  const map = new Map<string, PartnerGroup>();
  for (const row of rows) {
    const group = map.get(row.partnerId) ?? {
      partnerId: row.partnerId,
      partnerName: row.partnerName,
      partnerPhone: row.partnerPhone,
      rows: [],
      totalCents: 0n,
    };
    group.rows.push(row);
    group.totalCents += row.dueCents;
    map.set(row.partnerId, group);
  }
  return [...map.values()];
}

export default async function OverduePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;

  const t = await getTranslations('credit');
  const shell = await loadShell(loc);
  const { overdue, dueSoon } = await withPageCtx(async (ctx) => ({
    overdue: await listOverdue(ctx),
    dueSoon: await listDueSoon(ctx, 7),
  }));

  const groups = groupByPartner(overdue);

  const reminderFor = (r: OverdueRow, phone: string | null, partnerName: string) =>
    whatsappLink(
      phone,
      buildReminderMessage(loc, {
        partnerName,
        shopName: shell.active.name,
        amountCents: r.dueCents,
        dueDate: r.dueDate,
        contractNumber: r.contractNumber,
        daysLate: r.daysLate,
      }),
    );

  const renderRow = (r: OverdueRow, phone: string | null, partnerName: string) => {
    const wa = reminderFor(r, phone, partnerName);
    return (
      <li key={r.installmentId} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col text-sm">
          <Link href={`/credit/contracts/${r.contractId}`} className="font-medium underline">
            {r.contractNumber} · #{r.seq}
          </Link>
          <span className="text-muted-foreground">
            {r.dueDate} · {t('overdue.days_late', { days: r.daysLate })}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium tabular-nums">{formatDzd(r.dueCents, loc)}</span>
          {phone ? (
            <a href={`tel:${phone}`} className="underline">
              {t('overdue.call')}
            </a>
          ) : null}
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="underline">
              {t('overdue.whatsapp')}
            </a>
          ) : null}
          <AiDraftButton contractId={r.contractId} phone={phone} />
        </div>
      </li>
    );
  };

  return (
    <section className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">{t('menu.overdue')}</h1>

      <div className="flex flex-col gap-4">
        <h2 className="font-medium">{t('overdue.title')}</h2>
        {groups.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            {t('overdue.empty')}
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.partnerId} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{g.partnerName}</span>
                <span className="text-sm tabular-nums">{formatDzd(g.totalCents, loc)}</span>
              </div>
              <ul className="flex flex-col gap-2">{g.rows.map((r) => renderRow(r, g.partnerPhone, g.partnerName))}</ul>
            </div>
          ))
        )}
      </div>

      {dueSoon.length > 0 ? (
        <div className="flex flex-col gap-4">
          <h2 className="font-medium">
            {t('reminder.due_soon')} · {formatDzd(sumCents(dueSoon.map((r) => r.dueCents)), loc)}
          </h2>
          <ul className="flex flex-col gap-2">
            {dueSoon.map((r) => renderRow(r, r.partnerPhone, r.partnerName))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
