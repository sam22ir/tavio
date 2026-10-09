import Link from 'next/link';
import { ErrorToast } from '@/ui/feedback/error-toast';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { cancelMoveForm, validateMoveForm } from '@/modules/inventory/actions';
import { getMove } from '@/modules/inventory/service/moves';
import { Chatter } from '@/modules/chatter/ui/chatter';
import { Button } from '@/ui/primitives/button';

export default async function MoveDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('inventory');
  const tViews = await getTranslations('views');
  const { error: failure } = await searchParams;
  const currentLocale = await getLocale();
  const result = await withPageCtx((ctx) => getMove(ctx, id));
  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return (
      <main className="p-4 md:p-6">
        <p role="alert" className="text-sm text-destructive">{t('common.error')}</p>
      </main>
    );
  }
  const move = result.value;
  const doneAt = move.doneAt ? new Date(move.doneAt).toLocaleString(currentLocale) : '–';

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      {failure ? <ErrorToast message={tViews('error')} /> : null}
      <Link href={`/${currentLocale}/inventory/moves`} className="text-sm text-muted-foreground hover:underline">
        ← {t('moves.title')}
      </Link>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold break-words">{move.reference}</h1>
          <span className="text-sm text-muted-foreground">{t(`options.state.${move.state}`)}</span>
        </div>
        {move.state === 'draft' ? (
          <div className="flex flex-wrap gap-3">
            <form action={validateMoveForm}>
              <input type="hidden" name="id" value={move.id} />
              <Button type="submit">{t('moves.validate')}</Button>
            </form>
            <form action={cancelMoveForm}>
              <input type="hidden" name="id" value={move.id} />
              <Button type="submit" variant="outline">{t('moves.cancel')}</Button>
            </form>
          </div>
        ) : null}
      </header>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-md border p-4 sm:grid-cols-2">
        <Item label={t('fields.product')} value={move.productName} />
        <Item label={t('fields.quantity')} value={move.quantity} />
        <Item label={t('fields.from')} value={move.fromLocationName} />
        <Item label={t('fields.to')} value={move.toLocationName} />
        <Item label={t('fields.done_at')} value={doneAt} />
      </dl>
      <Chatter entity="inventory.move" recordId={move.id} />
    </main>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm">{value}</dd>
    </div>
  );
}
