'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/primitives/dialog';
import { Input } from '@/ui/primitives/input';
import { interpretQuery } from '@/modules/ai_features/search/actions';
import type { SearchResponse } from '@/modules/ai_features/search/search';

/** Command palette (Ctrl+K or the search button). Natural-language query, read-only. */
export function CommandSearch() {
  const t = useTranslations('ai_search');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open || query.trim() === '') return;
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await interpretQuery({ q: query });
        if (mine !== seq.current) return;
        if (res.ok) {
          setResponse(res.value);
          setError(null);
        } else {
          setResponse(null);
          setError(res.error.message);
        }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, open]);

  const visible = open && query.trim() !== '' ? response : null;
  const visibleError = open && query.trim() !== '' ? error : null;

  return (
    <>
      <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setOpen(true)}>
        {t('palette.button')}
        <kbd className="ms-auto text-xs text-muted-foreground">Ctrl K</kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('palette.title')}</DialogTitle>
            <DialogDescription>{t('palette.hint')}</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('palette.placeholder')}
            aria-label={t('palette.placeholder')}
          />
          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto" aria-live="polite">
            {pending ? <p className="text-sm text-muted-foreground">{t('palette.searching')}</p> : null}
            {visibleError ? <p className="text-sm text-destructive">{visibleError}</p> : null}
            {visible?.href ? (
              <Link href={visible.href} onClick={() => setOpen(false)} className="rounded-md border p-2 text-sm font-medium underline">
                {t('palette.go')}
              </Link>
            ) : null}
            {visible && visible.hits.length === 0 && !visible.href && !pending ? (
              <p className="text-sm text-muted-foreground">{t('palette.empty')}</p>
            ) : null}
            {visible?.hits.map((hit) => (
              <Link key={`${hit.kind}-${hit.href}`} href={hit.href} onClick={() => setOpen(false)} className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-default">
                <span>{hit.label}</span>
                <span className="text-xs text-muted-foreground">{t(`palette.kind.${hit.kind}`)}</span>
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
