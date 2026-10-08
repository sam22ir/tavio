'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/ui/primitives/button';
import { Textarea } from '@/ui/primitives/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/primitives/dialog';
import { activateContractById, cancelContractById } from '@/modules/credit_sales/actions/contracts';

interface Props {
  contractId: string;
  state: string;
}

export function ContractActions({ contractId, state }: Props) {
  const t = useTranslations('credit');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);

  function activate() {
    startTransition(async () => {
      const res = await activateContractById(contractId);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(t('contract.activated', { number: res.value.number }));
      router.refresh();
    });
  }

  function cancel() {
    startTransition(async () => {
      const res = await cancelContractById(contractId, reason.trim());
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setOpen(false);
      toast.success(t('contract.cancelled'));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {state === 'draft' ? (
        <Button onClick={activate} disabled={pending}>{t('contract.activate')}</Button>
      ) : null}
      {state === 'draft' || state === 'active' ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">{t('contract.cancel')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('contract.cancelTitle')}</DialogTitle>
              <DialogDescription>{t('contract.cancelBody')}</DialogDescription>
            </DialogHeader>
            <Textarea
              aria-label={t('contract.cancelReason')}
              placeholder={t('contract.cancelReason')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>{t('contract.form.cancel')}</Button>
              <Button variant="destructive" onClick={cancel} disabled={pending || !reason.trim()}>
                {t('contract.cancelConfirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
