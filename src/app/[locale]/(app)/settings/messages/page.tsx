import Link from 'next/link';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import type { Locale } from '@/core/ctx';
import { withTenant } from '@/core/db/tenant';
import { listOutboundMessages } from '@/core/messaging/service';
import { routing } from '@/i18n/routing';
import { loadShell } from '@/ui/shell/load-shell';
import { formatDate } from '@/modules/credit_sales/print/shared';

const PAGE_SIZE = 50;
const STATES = ['all', 'queued', 'sent', 'failed', 'manual'] as const;
const CHANNELS = ['all', 'email', 'whatsapp'] as const;

export default async function MessagesLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ state?: string; channel?: string; page?: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const sp = await searchParams;
  const state = (STATES as readonly string[]).includes(sp.state ?? '') ? sp.state! : 'all';
  const channel = (CHANNELS as readonly string[]).includes(sp.channel ?? '') ? sp.channel! : 'all';
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const shell = await loadShell(locale as Locale);
  const t = await getTranslations('messaging.log');
  const res = await withTenant(shell.tenant, (ctx) =>
    listOutboundMessages(ctx, { state: state === 'all' ? undefined : state, channel: channel === 'all' ? undefined : channel, page, pageSize: PAGE_SIZE }),
  );

  const base = `/${locale}/settings/messages`;
  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams({ state, channel, page: String(page), ...over });
    return `${base}?${p.toString()}`;
  };

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {t('filter')}
          <select name="state" defaultValue={state}>
            {STATES.map((s) => <option key={s} value={s}>{t(`state.${s}`)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <select name="channel" defaultValue={channel}>
            {CHANNELS.map((c) => <option key={c} value={c}>{t(`channel.${c}`)}</option>)}
          </select>
        </label>
        <button type="submit" className="h-11 rounded-2xl border border-separator px-4 text-sm">{t('filter')}</button>
      </form>

      {!res.ok ? (
        <p className="text-sm text-danger">{res.error.message}</p>
      ) : res.value.rows.length === 0 ? (
        <p className="text-sm text-muted">{t('empty')}</p>
      ) : (
        <>
          <p className="text-xs text-muted">{t('total', { count: res.value.total })}</p>
          <section className="app-panel flex flex-col gap-4 p-5">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-default/40 text-start">
                    <tr>
                      <th className="p-2 text-start">{t('created')}</th>
                      <th className="p-2 text-start">{t('to')}</th>
                      <th className="p-2 text-start">{t('subject')}</th>
                      <th className="p-2 text-start">{t('template')}</th>
                      <th className="p-2 text-start">{t('status')}</th>
                      <th className="p-2 text-start">{t('attempts')}</th>
                      <th className="p-2 text-start">{t('error')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.value.rows.map((r) => (
                      <tr key={r.id} className="border-t align-top">
                        <td className="p-2 whitespace-nowrap">{formatDate(r.createdAt, locale as Locale)}</td>
                        <td className="p-2 break-all">{r.toAddress}</td>
                        <td className="p-2" dir="auto">{r.subject}</td>
                        <td className="p-2">{r.templateKey ?? '—'}</td>
                        <td className="p-2">
                          {t(`state.${r.state}`)}
                          {r.state === 'manual' && r.waUrl ? (
                            <a href={r.waUrl} target="_blank" rel="noopener noreferrer" className="ms-2 underline">{t('openWa')}</a>
                          ) : null}
                        </td>
                        <td className="p-2 tabular-nums">{r.attempts}</td>
                        <td className="p-2 text-danger">{r.state === 'failed' || r.lastError ? r.lastError : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </section>
          <div className="flex gap-3 text-sm">
            {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="underline">{t('prev')}</Link> : null}
            {page * PAGE_SIZE < res.value.total ? <Link href={qs({ page: String(page + 1) })} className="underline">{t('next')}</Link> : null}
          </div>
        </>
      )}
    </section>
  );
}
