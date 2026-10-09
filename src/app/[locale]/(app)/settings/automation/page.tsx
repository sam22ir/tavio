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
    return <main className="p-4 md:p-6"><p role="alert" className="text-sm text-destructive">{t('forbidden')}</p></main>;
  }

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      {rules.length === 0 ? <p className="text-sm text-muted-foreground">{t('empty')}</p> : null}
      <div className="flex flex-col gap-4">
        {rules.map((rule) => {
          const cond = (rule.conditions as { field: string; op: string; value: string }[])[0];
          const cfg = rule.actionConfig as Record<string, unknown>;
          const defaults: RuleDefaults = {
            id: rule.id,
            name: rule.name,
            triggerEvent: rule.triggerEvent,
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
            active: rule.active,
          };
          return (
            <details key={rule.id} className="rounded-lg border p-4">
              <summary className="cursor-pointer font-medium">
                {rule.name} · {t(`triggers.${rule.triggerEvent}`)} · {rule.active ? t('status.active') : t('status.inactive')}
              </summary>
              <div className="mt-4">
                <RuleForm action={updateRuleForm} defaults={defaults} />
              </div>
            </details>
          );
        })}
      </div>
      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="font-medium">{t('new')}</h2>
        <RuleForm action={createRuleForm} />
      </section>
    </main>
  );
}
