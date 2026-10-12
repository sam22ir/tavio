import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { requirePerm } from '@/core/perms';
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
    return <div className="p-4 md:p-6"><p role="alert" className="text-sm text-destructive">{t('forbidden')}</p></div>;
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      {rules.length === 0 ? <p className="text-sm text-muted">{t('empty')}</p> : null}
      <div className="flex flex-col gap-4">
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
            <details key={rule.id} className="rounded-2xl bg-surface-secondary p-4">
              <summary className="cursor-pointer font-medium">
                {rule.name} · {rule.triggerEvent ? t(`triggers.${rule.triggerEvent.replaceAll(".", "_")}`) : t('kinds.time')} · {rule.active ? t('status.active') : t('status.inactive')}
              </summary>
              <div className="mt-4">
                <RuleForm action={updateRuleForm} defaults={defaults} />
              </div>
            </details>
          );
        })}
      </div>
      <section className="flex flex-col gap-3 rounded-2xl bg-surface-secondary p-4">
        <h2 className="font-medium">{t('new')}</h2>
        <RuleForm action={createRuleForm} />
      </section>
    </div>
  );
}
