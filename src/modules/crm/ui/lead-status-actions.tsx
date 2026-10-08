'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { Result } from '@/core/result';
import { Button } from '@/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/primitives/dialog';
import { Label } from '@/ui/primitives/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/primitives/select';
import { Textarea } from '@/ui/primitives/textarea';

type Reason = { id: string; name: string };
type Action<I> = (input: I) => Promise<Result<unknown>>;

interface LeadStatusActionsProps {
  id: string;
  status: string;
  reasons: Reason[];
  markWon: Action<{ id: string }>;
  markLost: Action<{ id: string; lostReasonId?: string; note?: string }>;
  reopen: Action<{ id: string }>;
}

export function LeadStatusActions({ id, status, reasons, markWon, markLost, reopen }: LeadStatusActionsProps) {
  const t = useTranslations('crm.ui');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lostOpen, setLostOpen] = useState(false);
  const [reason, setReason] = useState<string>('');
  const [note, setNote] = useState('');

  const run = (fn: () => Promise<Result<unknown>>, onOk?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error.message || t('error'));
        return;
      }
      onOk?.();
      toast.success(t('updated'));
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === 'open' ? (
        <>
          <Button size="sm" disabled={pending} onClick={() => run(() => markWon({ id }))}>
            {t('won')}
          </Button>
          <Dialog open={lostOpen} onOpenChange={setLostOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={pending}>
                {t('lost')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('lostTitle')}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>{t('lostReason')}</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('noReason')} />
                    </SelectTrigger>
                    <SelectContent>
                      {reasons.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="lost-note">{t('lostNote')}</Label>
                  <Textarea id="lost-note" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={pending}
                  onClick={() =>
                    run(
                      () =>
                        markLost({
                          id,
                          lostReasonId: reason || undefined,
                          note: note.trim() || undefined,
                        }),
                      () => setLostOpen(false),
                    )
                  }
                >
                  {t('lostConfirm')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => reopen({ id }))}>
          {t('reopen')}
        </Button>
      )}
    </div>
  );
}
