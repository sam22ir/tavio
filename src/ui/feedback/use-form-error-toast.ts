'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import type { FormState } from '@/core/entities/types';

/**
 * Shows a sonner error toast when a form action fails. errorText is the already-translated message
 * for the current state (empty when there is nothing to show). Each failed submission toasts once.
 */
export function useFormErrorToast(state: FormState, errorText: string): void {
  useEffect(() => {
    if (state.ok === false && errorText) toast.error(errorText);
  }, [state, errorText]);
}
