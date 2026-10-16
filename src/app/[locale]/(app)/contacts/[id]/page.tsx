import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { archivePartnerForm, updatePartnerForm } from '@/modules/contacts/actions';
import { partnerEntity } from '@/modules/contacts/entities';
import { getPartner, partnerFormValues, type PartnerRow } from '@/modules/contacts/service/partners';
import { Chatter } from '@/modules/chatter/ui/chatter';
import { ScoreBadge } from '@/modules/credit_sales/ui/score-badge';
import { listCustomFieldDefs } from '@/modules/platform/service/custom-fields';
import { CustomFieldsEditor, type CustomFieldView } from '@/modules/platform/ui/custom-fields-editor';
import { Button } from '@/ui/primitives/button';
import { RecordForm } from '@/ui/views/record-form';
import { PortalShareButton } from '@/core/portal/ui/portal-share-button';
import { RelatedLinks } from '@/ui/views/related-links';
import { formatCell } from '@/ui/views/format';
import { PARTNER_FORM_ENTITY } from '../_lib/form-entity';
import { PartnerTabs } from '../_lib/partner-tabs';

type Locale = 'fr' | 'ar' | 'en';

// Read-only fields on the Information tab, in display order. Roles are rendered separately.
const INFO_FIELDS = [
  'nif', 'nis', 'rc', 'ai', 'phone', 'phoneAlt', 'email', 'address',
  'wilayaCode', 'commune', 'employer', 'monthlyIncomeCents', 'notes',
] as const;

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations();
  const currentLocale = (await getLocale()) as Locale;
  const listHref = `/${currentLocale}/contacts`;

  const result = await withPageCtx((ctx) => getPartner(ctx, id));
  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return (
      <div>
        <p role="alert" className="text-sm text-danger">
          {t('contacts.partner.error')}
        </p>
      </div>
    );
  }
  const partner: PartnerRow = result.value;

  const defsResult = await withPageCtx((ctx) => listCustomFieldDefs(ctx, 'contacts.partner'));
  const customFields: CustomFieldView[] = defsResult.ok
    ? defsResult.value.map((d) => ({
        key: d.key,
        labelFr: d.labelFr,
        labelAr: d.labelAr,
        labelEn: d.labelEn,
        fieldType: d.fieldType as CustomFieldView['fieldType'],
        options: (d.options as string[] | null) ?? [],
        required: d.required,
      }))
    : [];
  const customValues = (partner.custom ?? {}) as Record<string, string | number | boolean | null>;
  const tPlatform = await getTranslations('platform');

  const kindLabel = partner.kind === 'company' ? t('contacts.options.kind.company') : t('contacts.options.kind.individual');
  const roles = [
    partner.isCustomer ? t('contacts.fields.isCustomer') : null,
    partner.isSupplier ? t('contacts.fields.isSupplier') : null,
    partner.isProspect ? t('contacts.fields.isProspect') : null,
  ].filter((r): r is string => r !== null);

  const info = (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-2xl bg-surface-secondary p-4 sm:grid-cols-2">
      <InfoItem label={t('contacts.partner.roles')} value={roles.length ? roles.join(', ') : '–'} />
      <InfoItem label={t('contacts.fields.kind')} value={kindLabel} />
      {INFO_FIELDS.map((name) => {
        const field = partnerEntity.fields.find((f) => f.name === name);
        const value = field ? formatCell(field, partner[name], currentLocale) : '–';
        return <InfoItem key={name} label={t(`contacts.fields.${name}`)} value={value} />;
      })}
    </dl>
  );

  return (
    <div className="flex flex-col gap-6">
      <PortalShareButton mode="invite" partnerId={partner.id} />
      <Link href={listHref} className="text-sm text-muted hover:underline">
        ← {t('contacts.partner.title')}
      </Link>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{partner.displayName}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>{kindLabel}</span>
            {partner.active ? null : (
              <span className="text-danger">{t('contacts.partner.inactive')}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ScoreBadge partnerId={id} />
          {partner.active ? (
            <form action={archivePartnerForm}>
              <input type="hidden" name="id" value={id} />
              <Button type="submit" variant="outline">
                {t('contacts.partner.archive')}
              </Button>
            </form>
          ) : null}
        </div>
      </header>
      <RelatedLinks source="contacts.partner" id={id} />

      <PartnerTabs
        infoLabel={t('contacts.partner.tabs.info')}
        editLabel={t('contacts.partner.tabs.edit')}
        info={info}
        edit={
          <div className="max-w-2xl">
            <RecordForm
              entity={PARTNER_FORM_ENTITY}
              values={partnerFormValues(partner)}
              action={updatePartnerForm}
              hidden={{ id }}
            />
          </div>
        }
      />

      <section aria-labelledby="partner-custom" className="flex flex-col gap-3">
        <h2 id="partner-custom" className="text-base font-semibold">
          {tPlatform('custom.title')}
        </h2>
        <CustomFieldsEditor entity="contacts.partner" recordId={id} fields={customFields} values={customValues} />
      </section>

      <section aria-labelledby="partner-activity" className="flex flex-col gap-3">
        <h2 id="partner-activity" className="text-base font-semibold">
          {t('contacts.partner.activity')}
        </h2>
        <Chatter entity="contacts.partner" recordId={id} />
      </section>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm break-words">{value}</dd>
    </div>
  );
}
