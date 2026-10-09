import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { createProjectForm } from '@/modules/projects/actions';
import { searchPartnerOptions } from '@/modules/contacts/actions';
import { RecordForm } from '@/ui/views/record-form';
import { PROJECT_FORM_ENTITY } from '../_lib/form-entity';

export default async function NewProjectPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('projects');
  const partners = await searchPartnerOptions();

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('project.new')}</h1>
      <div className="max-w-2xl">
        <RecordForm
          entity={PROJECT_FORM_ENTITY}
          action={createProjectForm}
          submitLabel={t('project.new')}
          relationOptions={{ partnerId: partners }}
        />
      </div>
    </main>
  );
}
