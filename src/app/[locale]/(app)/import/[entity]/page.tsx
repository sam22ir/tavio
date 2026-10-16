import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { routing } from '@/i18n/routing';
import { buttonVariants } from '@/ui/primitives/button';
import { cn } from '@/ui/lib/cn';
import { ImportWizard } from '../_components/import-wizard';
import { importFieldsFor, isImportEntity, IMPORT_TARGETS, type ImportEntityName } from '../_lib/targets';

export default async function ImportPage({
  params,
}: {
  params: Promise<{ locale: string; entity: string }>;
}) {
  const { locale, entity } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (!isImportEntity(entity)) notFound();
  setRequestLocale(locale);

  const target = IMPORT_TARGETS[entity];
  const lang = locale as 'fr' | 'ar' | 'en';
  const t = await getTranslations('io.import');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href={`/${locale}/${entityListPath(entity)}`} className={cn(buttonVariants({ variant: 'ghost' }), 'w-fit')}>
          {t('back')}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      </div>
      <ImportWizard
        entityName={entity}
        fields={importFieldsFor(target, lang)}
        duplicateRule={t('dup_rule', { key: t(target.duplicateKeyLabel.replace('io.import.', '')) })}
        backHref={`/${locale}/${entityListPath(entity)}`}
        wholeFile={!!target.wholeFile}
        templateHref={`/${locale}/import/${entity}/template`}
      />
    </div>
  );
}

function entityListPath(entity: ImportEntityName): string {
  switch (entity) {
    case 'contacts.partner': return 'contacts';
    case 'products.product': return 'products';
    case 'crm.lead': return 'crm/list';
    case 'inventory.opening_stock': return 'inventory/adjustments';
    case 'accounting.chart_account': return 'accounting/accounts';
    case 'accounting.opening_balance': return 'accounting/entries';
    case 'sales.quote': return 'sales';
  }
}
