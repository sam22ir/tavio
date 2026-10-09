import { getTranslations } from 'next-intl/server';
import { whatsappLink } from '@/modules/credit_sales/service/reminders';
import { setRecipientStatusForm } from '../actions';
import type { RecipientRow } from '../service/campaigns';
import { Badge } from '@/ui/primitives/badge';
import { Button } from '@/ui/primitives/button';

export type RecipientView = RecipientRow & { message: string };

/** One card per recipient: name, phone, a WhatsApp link, and status buttons. Works at 360px and in RTL. */
export async function RecipientsTable({
  campaignId,
  channel,
  rows,
}: {
  campaignId: string;
  channel: string;
  rows: RecipientView[];
}) {
  const t = await getTranslations('marketing');

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('recipients.empty')}</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => {
        const link = channel === 'whatsapp' ? whatsappLink(row.phone, row.message) : null;
        const sent = row.status === 'sent';
        return (
          <li key={row.id} className="flex flex-col gap-3 rounded-md border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{row.partnerName}</span>
                <span dir="ltr" className="text-sm text-muted-foreground">
                  {row.phone}
                </span>
              </div>
              <Badge variant={sent ? 'default' : 'secondary'}>{t(`options.recipientStatus.${row.status}`)}</Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {link ? (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t('recipients.openWhatsapp')}
                </a>
              ) : null}
              <form action={setRecipientStatusForm} className="flex flex-wrap gap-2">
                <input type="hidden" name="recipientId" value={row.id} />
                <input type="hidden" name="campaignId" value={campaignId} />
                <Button type="submit" name="status" value={sent ? 'pending' : 'sent'} size="sm" variant={sent ? 'outline' : 'default'}>
                  {sent ? t('recipients.markPending') : t('recipients.markSent')}
                </Button>
                {sent ? null : (
                  <Button type="submit" name="status" value="failed" size="sm" variant="outline">
                    {t('recipients.markFailed')}
                  </Button>
                )}
              </form>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
