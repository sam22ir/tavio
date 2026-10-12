'use client';

import { toast } from 'sonner';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { API_SCOPES, CUSTOM_FIELD_TYPES, WEBHOOK_EVENTS, type CustomFieldType } from '../constants';
import {
  createApiKeyAction,
  createCustomFieldAction,
  createWebhookAction,
  deleteCustomFieldAction,
  revokeApiKeyAction,
  setWebhookActiveAction,
} from '../actions';
import { Badge } from '@/ui/primitives/badge';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/primitives/table';

export interface FieldRow {
  id: string;
  key: string;
  labelFr: string;
  labelAr: string;
  labelEn: string;
  fieldType: string;
  options: string[];
  required: boolean;
  position: number;
}

export interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface HookRow {
  id: string;
  url: string;
  events: string[];
  active: boolean;
}

type Status = { kind: 'ok' | 'error'; text: string } | null;

const SELECT_CLASS =
  'h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50';

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <p role={status.kind === 'error' ? 'alert' : 'status'} className={status.kind === 'error' ? 'text-sm text-destructive' : 'text-sm text-tint-success-fg'}>
      {status.text}
    </p>
  );
}

export function PlatformSettings({ fields, keys, hooks }: { fields: FieldRow[]; keys: KeyRow[]; hooks: HookRow[] }) {
  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <CustomFieldsSection fields={fields} />
      <ApiKeysSection keys={keys} />
      <WebhooksSection hooks={hooks} />
    </div>
  );
}

function CustomFieldsSection({ fields }: { fields: FieldRow[] }) {
  const t = useTranslations('platform');
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<Status>(null);
  const [fieldType, setFieldType] = useState<CustomFieldType>('text');

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const str = (k: string) => String(fd.get(k) ?? '');
    const options = str('options').split(',').map((s) => s.trim()).filter(Boolean);
    start(async () => {
      const r = await createCustomFieldAction({
        entity: 'contacts.partner',
        key: str('key'),
        labelFr: str('labelFr'),
        labelAr: str('labelAr'),
        labelEn: str('labelEn'),
        fieldType,
        options: fieldType === 'select' ? options : undefined,
        required: fd.get('required') === 'on',
        position: Number(str('position') || 0),
      });
      if (!r.ok) {
        setStatus({ kind: 'error', text: r.error.code === 'VALIDATION' || r.error.code === 'CONFLICT' ? r.error.message : t('errors.generic') }); toast.error(r.error.code === 'VALIDATION' || r.error.code === 'CONFLICT' ? r.error.message : t('errors.generic'));
        return;
      }
      formRef.current?.reset();
      setStatus({ kind: 'ok', text: t('custom.created') });
      router.refresh();
    });
  }

  function onDelete(id: string) {
    start(async () => {
      const r = await deleteCustomFieldAction({ id });
      setStatus(r.ok ? { kind: 'ok', text: t('custom.deleted') } : { kind: 'error', text: t('errors.generic') });
      if (!r.ok) toast.error(t('errors.generic'));
      if (r.ok) router.refresh();
    });
  }

  return (
    <section aria-labelledby="cf-title" className="flex flex-col gap-4">
      <h2 id="cf-title" className="text-lg font-medium">{t('custom.title')}</h2>
      <p className="text-sm text-muted">{t('custom.intro')}</p>
      <FieldTable fields={fields} onDelete={onDelete} pending={pending} />
      <form ref={formRef} onSubmit={onSubmit} className="grid gap-4 rounded-2xl bg-surface-secondary p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cf-key">{t('custom.fields.key')}</Label>
          <Input id="cf-key" name="key" required pattern="[a-z][a-z0-9_]{0,39}" dir="ltr" className="min-h-11" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cf-type">{t('custom.fields.type')}</Label>
          <select id="cf-type" className={SELECT_CLASS} value={fieldType} onChange={(e) => setFieldType(e.target.value as CustomFieldType)}>
            {CUSTOM_FIELD_TYPES.map((type) => (
              <option key={type} value={type}>{t(`custom.types.${type}`)}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cf-fr">{t('custom.fields.label_fr')}</Label>
          <Input id="cf-fr" name="labelFr" required className="min-h-11" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cf-ar">{t('custom.fields.label_ar')}</Label>
          <Input id="cf-ar" name="labelAr" required className="min-h-11" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cf-en">{t('custom.fields.label_en')}</Label>
          <Input id="cf-en" name="labelEn" required className="min-h-11" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cf-position">{t('custom.fields.position')}</Label>
          <Input id="cf-position" name="position" type="number" min={0} defaultValue={0} className="min-h-11" />
        </div>
        {fieldType === 'select' ? (
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="cf-options">{t('custom.fields.options')}</Label>
            <Input id="cf-options" name="options" required placeholder={t('custom.fields.options_hint')} className="min-h-11" />
          </div>
        ) : null}
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="required" className="size-5" />
          {t('custom.fields.required')}
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending} className="min-h-11">{t('custom.add')}</Button>
        </div>
        <div className="sm:col-span-2"><StatusLine status={status} /></div>
      </form>
    </section>
  );
}

function FieldTable({ fields, onDelete, pending }: { fields: FieldRow[]; onDelete: (id: string) => void; pending: boolean }) {
  const t = useTranslations('platform');
  if (fields.length === 0) return <p className="text-sm text-muted">{t('custom.empty')}</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('custom.fields.key')}</TableHead>
            <TableHead>{t('custom.fields.label_en')}</TableHead>
            <TableHead>{t('custom.fields.type')}</TableHead>
            <TableHead>{t('custom.fields.required')}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((f) => (
            <TableRow key={f.id}>
              <TableCell className="font-mono">{f.key}</TableCell>
              <TableCell>{f.labelEn}</TableCell>
              <TableCell>{t(`custom.types.${f.fieldType}`)}</TableCell>
              <TableCell>{f.required ? t('common.yes') : t('common.no')}</TableCell>
              <TableCell>
                <Button type="button" variant="outline" className="min-h-11 min-w-11" disabled={pending} onClick={() => onDelete(f.id)}>
                  {t('custom.remove')}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ApiKeysSection({ keys }: { keys: KeyRow[] }) {
  const t = useTranslations('platform');
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<Status>(null);
  const [revealed, setRevealed] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const scopes = API_SCOPES.filter((s) => fd.get(`scope-${s}`) === 'on');
    start(async () => {
      const r = await createApiKeyAction({ name: String(fd.get('name') ?? ''), scopes: [...scopes] });
      if (!r.ok) {
        setStatus({ kind: 'error', text: t('errors.generic') }); toast.error(t('errors.generic'));
        return;
      }
      setRevealed(r.value.token);
      formRef.current?.reset();
      router.refresh();
    });
  }

  function onRevoke(id: string) {
    start(async () => {
      const r = await revokeApiKeyAction({ id });
      setStatus(r.ok ? { kind: 'ok', text: t('keys.revoked') } : { kind: 'error', text: t('errors.generic') });
      if (r.ok) router.refresh();
    });
  }

  return (
    <section aria-labelledby="keys-title" className="flex flex-col gap-4">
      <h2 id="keys-title" className="text-lg font-medium">{t('keys.title')}</h2>
      <p className="text-sm text-muted">{t('keys.intro')}</p>
      {revealed ? (
        <div role="alert" className="flex flex-col gap-2 rounded-md border bg-tint-warning p-3 text-sm text-tint-warning-fg">
          <p className="font-medium">{t('keys.shown_once')}</p>
          <code dir="ltr" className="break-all rounded bg-background p-2 font-mono text-xs">{revealed}</code>
          <Button type="button" variant="outline" className="min-h-11 self-start" onClick={() => setRevealed(null)}>
            {t('keys.dismiss')}
          </Button>
        </div>
      ) : null}
      {keys.length === 0 ? (
        <p className="text-sm text-muted">{t('keys.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('keys.name')}</TableHead>
                <TableHead>{t('keys.prefix')}</TableHead>
                <TableHead>{t('keys.scopes')}</TableHead>
                <TableHead>{t('keys.status')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <TableRow key={k.id}>
                  <TableCell>{k.name}</TableCell>
                  <TableCell className="font-mono">{k.prefix}…</TableCell>
                  <TableCell className="font-mono text-xs">{k.scopes.join(', ')}</TableCell>
                  <TableCell>
                    <Badge variant={k.revokedAt ? 'secondary' : 'default'}>
                      {k.revokedAt ? t('keys.revoked_badge') : t('keys.active_badge')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {k.revokedAt ? null : (
                      <Button type="button" variant="outline" className="min-h-11 min-w-11" disabled={pending} onClick={() => onRevoke(k.id)}>
                        {t('keys.revoke')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4 rounded-2xl bg-surface-secondary p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="key-name">{t('keys.name')}</Label>
          <Input id="key-name" name="name" required maxLength={100} className="min-h-11" />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{t('keys.scopes')}</legend>
          {API_SCOPES.map((s) => (
            <label key={s} className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" name={`scope-${s}`} className="size-5" />
              <span dir="ltr" className="font-mono">{s}</span>
            </label>
          ))}
        </fieldset>
        <Button type="submit" disabled={pending} className="min-h-11 self-start">{t('keys.create')}</Button>
        <StatusLine status={status} />
      </form>
    </section>
  );
}

function WebhooksSection({ hooks }: { hooks: HookRow[] }) {
  const t = useTranslations('platform');
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<Status>(null);
  const [revealed, setRevealed] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const events = WEBHOOK_EVENTS.filter((ev) => fd.get(`event-${ev}`) === 'on');
    start(async () => {
      const r = await createWebhookAction({ url: String(fd.get('url') ?? ''), events: [...events] });
      if (!r.ok) {
        setStatus({ kind: 'error', text: r.error.code === 'VALIDATION' ? r.error.message : t('errors.generic') }); toast.error(r.error.code === 'VALIDATION' ? r.error.message : t('errors.generic'));
        return;
      }
      setRevealed(r.value.secret);
      formRef.current?.reset();
      router.refresh();
    });
  }

  function onToggle(id: string, active: boolean) {
    start(async () => {
      const r = await setWebhookActiveAction({ id, active: !active });
      setStatus(r.ok ? { kind: 'ok', text: t('hooks.updated') } : { kind: 'error', text: t('errors.generic') });
      if (r.ok) router.refresh();
    });
  }

  return (
    <section aria-labelledby="hooks-title" className="flex flex-col gap-4">
      <h2 id="hooks-title" className="text-lg font-medium">{t('hooks.title')}</h2>
      <p className="text-sm text-muted">{t('hooks.intro')}</p>
      {revealed ? (
        <div role="alert" className="flex flex-col gap-2 rounded-md border bg-tint-warning p-3 text-sm text-tint-warning-fg">
          <p className="font-medium">{t('hooks.secret_once')}</p>
          <code dir="ltr" className="break-all rounded bg-background p-2 font-mono text-xs">{revealed}</code>
          <Button type="button" variant="outline" className="min-h-11 self-start" onClick={() => setRevealed(null)}>
            {t('keys.dismiss')}
          </Button>
        </div>
      ) : null}
      {hooks.length === 0 ? (
        <p className="text-sm text-muted">{t('hooks.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('hooks.url')}</TableHead>
                <TableHead>{t('hooks.events')}</TableHead>
                <TableHead>{t('hooks.status')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {hooks.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="max-w-64 truncate font-mono text-xs" dir="ltr">{h.url}</TableCell>
                  <TableCell className="font-mono text-xs">{h.events.join(', ')}</TableCell>
                  <TableCell>
                    <Badge variant={h.active ? 'default' : 'secondary'}>
                      {h.active ? t('hooks.active') : t('hooks.paused')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button type="button" variant="outline" className="min-h-11 min-w-11" disabled={pending} onClick={() => onToggle(h.id, h.active)}>
                      {h.active ? t('hooks.pause') : t('hooks.resume')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4 rounded-2xl bg-surface-secondary p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="hook-url">{t('hooks.url')}</Label>
          <Input id="hook-url" name="url" type="url" required dir="ltr" placeholder="https://" className="min-h-11" />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{t('hooks.events')}</legend>
          {WEBHOOK_EVENTS.map((ev) => (
            <label key={ev} className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" name={`event-${ev}`} className="size-5" />
              <span dir="ltr" className="font-mono">{ev}</span>
            </label>
          ))}
        </fieldset>
        <Button type="submit" disabled={pending} className="min-h-11 self-start">{t('hooks.create')}</Button>
        <StatusLine status={status} />
      </form>
    </section>
  );
}
