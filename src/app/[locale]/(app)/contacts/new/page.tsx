import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { createPartnerForm } from '@/modules/contacts/actions';
import { RecordForm } from '@/ui/views/record-form';
import { PARTNER_FORM_ENTITY } from '../_lib/form-entity';

export default async function NewContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('contacts');

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('partner.new')}</h1>
      <div className="max-w-2xl">
        <RecordForm entity={PARTNER_FORM_ENTITY} action={createPartnerForm} submitLabel={t('partner.new')} />
      </div>
    </div>
  );
}
