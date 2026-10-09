'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/ui/primitives/button';
import { markReservedById, startReviewById, submitContractById } from '../actions/workflow';

export type WorkflowStep = 'submit' | 'review' | 'reserve';

/** Which one-click steps the bar offers for a state. Approve and refuse live in the decision section; activation lives in ContractActions. */
export function workflowButtons(state: string): WorkflowStep[] {
  switch (state) {
    case 'draft':
      return ['submit'];
    case 'submitted':
      return ['review'];
    case 'approved':
      return ['reserve'];
    default:
      return [];
  }
}

const RUN: Record<WorkflowStep, (id: string) => Promise<{ ok: boolean; error?: { message: string } }>> = {
  submit: submitContractById,
  review: startReviewById,
  reserve: markReservedById,
};

export function WorkflowBar({ contractId, state }: { contractId: string; state: string }) {
  const t = useTranslations('credit.workflow');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const steps = workflowButtons(state);
  if (steps.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={t('bar')}>
      {steps.map((step) => (
        <Button
          key={step}
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await RUN[step](contractId);
              if (!result.ok) {
                toast.error(result.error?.message ?? t('done'));
                return;
              }
              toast.success(t('done'));
              router.refresh();
            })
          }
        >
          {t(`actions.${step}`)}
        </Button>
      ))}
    </div>
  );
}
