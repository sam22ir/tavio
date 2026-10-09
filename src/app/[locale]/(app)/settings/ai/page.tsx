import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { and, count, gte, sum, eq } from 'drizzle-orm';
import type { Locale } from '@/core/ctx';
import { getAi } from '@/core/adapters/ai';
import { aiUsage } from '@/core/db/schema/ai';
import { withTenant } from '@/core/db/tenant';
import { routing } from '@/i18n/routing';
import { loadShell } from '@/ui/shell/load-shell';
import { Badge } from '@/ui/primitives/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/primitives/table';

export default async function AiSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const shell = await loadShell(locale as Locale);
  const t = await getTranslations('ai');
  // Reads provider name and model only. The API key never leaves getAi().
  const ai = getAi();

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const usage = await withTenant(shell.tenant, (ctx) =>
    ctx.tx
      .select({
        feature: aiUsage.feature,
        calls: count(),
        inputTokens: sum(aiUsage.inputTokens),
        outputTokens: sum(aiUsage.outputTokens),
      })
      .from(aiUsage)
      .where(and(eq(aiUsage.companyId, ctx.companyId), gte(aiUsage.createdAt, startOfMonth)))
      .groupBy(aiUsage.feature)
      .orderBy(aiUsage.feature),
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </header>

      <section aria-labelledby="ai-status-title" className="flex flex-col gap-3">
        <h2 id="ai-status-title" className="text-lg font-medium">
          {t('status.title')}
        </h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">{t('status.state')}</dt>
            <dd>
              {ai ? (
                <Badge>{t('status.configured')}</Badge>
              ) : (
                <Badge variant="outline">{t('status.not_configured')}</Badge>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('status.provider')}</dt>
            <dd className="font-mono">{ai?.name ?? t('status.none')}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('status.model')}</dt>
            <dd className="font-mono">{ai?.model ?? t('status.none')}</dd>
          </div>
        </dl>
        {ai && (
          <p className="text-sm text-muted-foreground">
            {ai.supportsVision ? t('status.vision_on') : t('status.vision_off')}
          </p>
        )}
      </section>

      <section aria-labelledby="ai-usage-title" className="flex flex-col gap-3">
        <h2 id="ai-usage-title" className="text-lg font-medium">
          {t('usage.title')}
        </h2>
        {usage.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('usage.empty')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('usage.feature')}</TableHead>
                <TableHead className="text-end">{t('usage.calls')}</TableHead>
                <TableHead className="text-end">{t('usage.input_tokens')}</TableHead>
                <TableHead className="text-end">{t('usage.output_tokens')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usage.map((row) => (
                <TableRow key={row.feature}>
                  <TableCell className="font-mono">{row.feature}</TableCell>
                  <TableCell className="text-end">{Number(row.calls)}</TableCell>
                  <TableCell className="text-end">{Number(row.inputTokens ?? 0)}</TableCell>
                  <TableCell className="text-end">{Number(row.outputTokens ?? 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section aria-labelledby="ai-setup-title" className="flex flex-col gap-3">
        <h2 id="ai-setup-title" className="text-lg font-medium">
          {t('setup.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('setup.body')}</p>
        <pre className="overflow-x-auto rounded-md border bg-muted p-3 text-xs" dir="ltr">
{`wrangler secret put AI_API_KEY
wrangler secret put AI_BASE_URL
wrangler secret put AI_MODEL
wrangler secret put AI_VISION_MODEL
wrangler secret put AI_PROVIDER
wrangler secret put AI_DAILY_LIMIT`}
        </pre>
      </section>
    </div>
  );
}
