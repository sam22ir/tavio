import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { requirePerm } from '@/core/perms';
import { ArrowRight, ChevronDown, Plus } from 'lucide-react';
import { StatusChip } from '@/ui/blocks/tint';
import { routing } from '@/i18n/routing';
import { createRuleForm, updateRuleForm } from '@/modules/automation/actions';
import { listRules } from '@/modules/automation/service/rules';
import { RuleForm, type RuleDefaults } from '@/modules/automation/ui/rule-form';

export default async function AutomationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('automation');
  const rules = await withPageCtx(async (ctx) => {
    const perm = requirePerm(ctx, 'automation.rule.read');
    return perm.ok ? listRules(ctx) : null;
  });
  if (!rules) {
    return <p role="alert" className="rounded-2xl bg-tint-danger p-4 text-sm text-tint-danger-fg">{t('forbidden')}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted">{t('subtitle')}</p>
      </header>
      {rules.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-separator p-6 text-center text-sm text-muted">{t('empty')}</p>
      ) : null}
      <div className="flex flex-col gap-3">
        {rules.map((rule) => {
          const cond = (rule.conditions as { field: string; op: string; value: string }[])[0];
          const cfg = rule.actionConfig as Record<string, unknown>;
          const time = rule.timeConfig as { entity?: string; dateField?: string; delayDays?: number } | null;
          const defaults: RuleDefaults = {
            id: rule.id,
            name: rule.name,
            kind: rule.kind,
            triggerEvent: rule.triggerEvent ?? undefined,
            timeEntity: time?.entity,
            dateField: time?.dateField,
            delayDays: time?.delayDays,
            condField: cond?.field,
            condOp: cond?.op,
            condValue: cond?.value,
            action: rule.action,
            entity: cfg.entity as string | undefined,
            recordIdField: cfg.recordIdField as string | undefined,
            typeKey: cfg.typeKey as string | undefined,
            summary: cfg.summary as string | undefined,
            dueInDays: cfg.dueInDays as number | undefined,
            body: cfg.body as string | undefined,
            url: cfg.url as string | undefined,
            planId: cfg.planId as string | undefined,
            ownerField: cfg.ownerField as string | undefined,
            cancelPrevious: cfg.cancelPrevious as boolean | undefined,
            updates: cfg.updates ? Object.entries(cfg.updates as Record<string, string>).map(([k, v]) => `${k}=${v}`).join('\n') : undefined,
            steps: cfg.actions ? JSON.stringify(cfg.actions, null, 2) : undefined,
            active: rule.active,
          };
          return (
            <details key={rule.id} className="app-panel group p-4 sm:p-5">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-2 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1 basis-48 truncate font-medium">{rule.name}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <StatusChip tint="info">
                    {rule.triggerEvent ? t(`triggers.${rule.triggerEvent.replaceAll('.', '_')}`) : t('kinds.time')}
                  </StatusChip>
                  <ArrowRight aria-hidden="true" className="size-3.5 text-muted rtl:rotate-180" />
                  <StatusChip tint="violet">{t(`actions.${rule.action}`)}</StatusChip>
                  <StatusChip tint={rule.active ? 'success' : 'neutral'}>
                    {rule.active ? t('status.active') : t('status.inactive')}
                  </StatusChip>
                </span>
                <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-4 border-t border-separator pt-4">
                <RuleForm action={updateRuleForm} defaults={defaults} />
              </div>
            </details>
          );
        })}
      </div>
      <section className="app-panel flex flex-col gap-4 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Plus aria-hidden="true" className="size-5 text-accent" />
          {t('new')}
        </h2>
        <RuleForm action={createRuleForm} />
      </section>
    </div>
  );
}
